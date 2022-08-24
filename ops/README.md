# Open Terms Archive Ops

Recipes to set up the infrastructure of and deploy Open Terms Archive.

## Requirements

1. Install [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html).
2. Install [Vagrant](https://www.vagrantup.com/downloads).
3. Install [VirtualBox](https://www.virtualbox.org/wiki/Downloads) to manage virtual machines. If you prefer Docker, or have an Apple Silicon machine, install [Docker](https://docs.docker.com/get-docker/) instead.
4. Create a dedicated SSH key with no password: `ssh-keygen -f ~/.ssh/ota-vagrant -q -N ""`. This key will be automatically used by Vagrant.

> VirtualBox is not compatible with Apple Silicon (M1…) processors. If you have such a machine, you will need to use the Docker provider. Since MongoDB cannot be installed on ARM, it is skipped in the infrastructure installation process. This means you cannot test the MongoDB storage repository with Vagrant with an Apple Silicon processor.

## Usage

**You should never apply changes to production from your machine.** We use continuous deployment to apply changes. To avoid making changes on the production server by mistake, we use [Vagrant](https://www.vagrantup.com) to describe and spawn virtual machines. By default all commands will only affect the Vagrant development virtual machine (VM).

### Launch

If you’re on an Apple Silicon processor or want to use Docker instead of VirtualBox, use `vagrant up --provider=docker`.

In all other cases, use `vagrant up` 🙂

You can then deploy the code to the running machine with all the options described below.

### Main commands

- To set up a full [(phoenix)](https://martinfowler.com/bliki/PhoenixServer.html) server:

```
ansible-playbook ops/site.yml
```

- To setup the infrastructure only:

```
ansible-playbook ops/infra.yml
```

- To setup the `Open Terms Archive` app only:

```
ansible-playbook ops/app.yml
```

### Vagrant quick reference

#### Connect to the virtual machine

```
vagrant up
vagrant ssh  # use "vagrant" as password
```

#### Start again with a clean virtual machine

```
vagrant halt  # stop machine
vagrant destroy  # remove machine
vagrant up
```

#### Troubleshooting: Remote host identification has changed

In case you get that kind of error:

```
fatal: [127.0.0.1]: UNREACHABLE! => changed=false
  msg: |-
    Failed to connect to the host via ssh: @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    @    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
    …
  unreachable: true
```

It may be because you already have a `known_host` registered with the same IP and port. To solve this, remove it from the entries using `ssh-keygen -R [127.0.0.1]:2222`.

#### Troubleshooting: Connection refused

If you have the following error:

```
Failed to connect to the host via ssh: ssh: connect to host 127.0.0.1 port 2222: Connection refused
```

You may have a collision on the default port `2222` used by Vagrant to forward SSH commands.
Run the following command to know which ports are forwarded for the virtual machine:

```
vagrant port
```

It should display something like that:

```
The forwarded ports for the machine are listed below. Please note that
these values may differ from values configured in the Vagrantfile if the
provider supports automatic port collision detection and resolution.

    22 (guest) => 2200 (host)
```

Modify the Ansible SSH options in the `ops/inventories/dev.yml` file with the proper `ansible_ssh_port`:

```
all:
  children:
    vagrant:
      hosts:
        127.0.0.1:
          […]
          ansible_ssh_port: 2200
          […]
```

### Logs

You can obtain logs from the process manager over SSH:

```
ssh <user>@<instance_hostname> pm2 logs ota
```

### Tags

Some tags are available to refine what will happen, use them with `--tags`:

- `setup`: to only setup system dependencies required by the app (cloning repo, installing app dependencies, all config files, and so on…)
- `start`: to start the app
- `stop`: to stop the app
- `restart`: to restart the app
- `update`: to update the app (pull code, install dependencies and restart app)
- `update-declarations`: to update services declarations (pull declarations, install dependencies and restart app)

For example, if you have changes to the core engine to deploy but no infrastructure changes, you can update the app only by running:

```
ansible-playbook ops/app.yml --tags update --limit <instance_name>
```

## Production

### Applying changes

To test locally your changes to the playbook before opening a pull request:

- Remove all traces of previous tests to ensure that your changes do not work by coincidence: `vagrant destroy && vagrant up`.
- Start by applying your changes on the virtual machine: `ansible-playbook ops/site.yml`.
- Connect through SSH to the virtual machine and check that everything works as intended: `vagrant ssh`, `pm2 logs`…
- Open a pull request and wait for it to be reviewed and merged. The continuous deployment process will take care of applying your changes to every production instance.

### Deploying manually from your machine

**You should not be doing this.** If something terrible is happening in production, did you try just stopping the instance? Any fix should be applied through a PR and deployed in CD to ensure reproducibility.

Note that executing the playbook on the `production` inventory will affect **all** production servers. Unless you know exactly what you are doing, you should always execute a playbook on a specific server only, add the `--limit` option with the instance name defined in `ops/inventories/production.yml` as parameter:

```
ansible-playbook --inventory ops/inventories/production.yml ops/site.yml --limit <instance_name>
```

### Allowed keys

Setting up the production infrastructure for publishing on the shared versions repository entails decrypting a private key managed with [Ansible Vault](https://docs.ansible.com/ansible/latest/user_guide/vault.html). It is decrypted with a password stored in the passwords database.

In case the instance you're deploying on is operated by the Core team, you should use the `OTA-bot` SSH private key instead of your personal one. You can thus run any of the commands with the `--private-key` option, passing it the path to the bot SSH private key. This key can be found in the passwords database.

### Commands examples

- Check deployment without actually applying changes for the `dating` instance:

```
ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit dating --check --diff
```

- Update the Open Terms Archive application only on the `dating` instance, without applying changes to the infrastructure:

```
ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit dating --tag update
```

- Update services declarations only on the `france` instance:

```
ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit france --tag update-declarations
```

- Stop the Open Terms Archive application only on the `france` instance:

```
ansible-playbook --inventory ops/inventories/production.yml ops/app.yml --limit france --tag stop
```

- Update the infrastructure and the Open Terms Archive application on all servers:

```
ansible-playbook --inventory ops/inventories/production.yml ops/site.yml
```

## Set up a new instance

### Provision a server

#### With [OVH Horizon](https://horizon.cloud.ovh.net/project/instances/)

Click on the `Launch Instance` button. Then fill in at least the following fields:

- `Instance name`.
- `Source`. Suggested: `Debian 11`.
- `Flavor`. Suggested: `b-7-flex`.
- `Key pair`. Suggested: Your own personal SSH key, to allow you to connect to the freshly created server.

#### Recommended specs

The following setup is sufficient to track 20 services:

- 1 vCore @ 1.8GHz
- 2 GB RAM
- 1 MBps bandwidth
- 20 GB disk space

The major factor for performance is bandwidth.

Disk space is used up linearily with time as the archive grows. The number of services, their frequency of change and the chosen storage mechanism will all influence the speed at which disk space is used. You can start with 20GB but will have to consider expansion in the future. You should be safe for a longer time period with 100GB.

We suggest using a dedicated attached volume for storage, independently from the main VM drive, so that you can more easily upgrade or format it.

### Define host

Add an entry to the production inventory file `ops/inventories/production.yml` for the created host with the server address and proper variables.

The host name can not contain dashes. Use snake_case.

### Configure instance

Create a JSON file in the `config` folder with the name of the instance.

### Create repositories

Create the `snapshot` and `version` repositories, with:

- A `main` branch.
- The `main` branch should be the default branch.
- At least one commit on this branch with some content (`README.md` and `LICENSE`).

Templates are provided to that end, for [declarations](https://github.com/OpenTermsArchive/template-declarations/), [snapshots](https://github.com/OpenTermsArchive/template-snapshots/) and [versions](https://github.com/OpenTermsArchive/template-versions/).

### Set up permissions

The @OTA-Bot GitHub user should have write access to all three (declarations, snapshots, versions) repositories, so it can publish data, create issues, and publish dataset releases.

Each instance should have a responsible entity, which we currently model as a [“team” in the @OpenTermsArchive](https://github.com/orgs/OpenTermsArchive/teams) GitHub organisation. Each team has write access to the three repositories, and @OTA-Bot should be added to that team along with the human maintainers.

## Optimise performance

### MongoDB

If you use MongoDB as storage, hosting the database on an XFS-formatted volume significantly improves performance.

The following instructions assume [OVH Horizon](https://horizon.cloud.ovh.net/project/instances/) for volume creation, but can be adapted for any cloud provider.

#### Mounting

- Create a volume with the highest speed possible.
- Attach the volume to the server that runs your Open Terms Archive instance.
- On the machine, check what is your volume with `lsblk` (it should be one with no partition).
- Then use `sudo fdisk /dev/sd$N` (where `$N` is the identifier of the volume) and answer `n`, `p`, `1`, `w`.
- Install XFS utilities `sudo apt-get install xfsprogs`
- Format the disk to XFS: `sudo mkfs.xfs -f /dev/sd$N1`/
- Finally, create a folder (for example in `/mnt`) and mount the volume in it: `sudo mount -t auto /dev/sd$N1 /mnt/disk`.

#### Unmounting

To remove a volume:

- Unmount it with `sudo umount /mnt/disk`.
- Unattach it from the Horizon console.
- Remove the volume from the Horizon console.
