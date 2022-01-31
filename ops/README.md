# Open Terms Archive Ops

Recipes to set up the infrastructure for the Open Terms Archive app and deploy it.

> Recettes pour mettre en place l'infrastructure et déployer l'application Open Terms Archive

## Requirements

- Install [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

### [For development only] Additional dependencies

To test the changes without impacting the production server, a Vagrantfile is provided to test the changes locally in a virtual machine. VirtualBox and Vagrant are therefore required.

- Install [VirtualBox](https://www.vagrantup.com/docs/installation/)
- Install [Vagrant](https://www.vagrantup.com/docs/installation/)

**:warning: VirtualBox does not currently support Apple Silicon architecture**, so it's not possible to use Vagrant to test changes locally with theses machines.

## Usage

To avoid making changes on the production server by mistake, by default all commands will only affect the Vagrant development virtual machine (VM). Note that the VM needs to be started before with `vagrant up`.\

To execute commands on the production servers you should specify it by adding the option `--inventory ops/inventories/production.yml` to the following commands:

- To setup a full [(phoenix)](https://martinfowler.com/bliki/PhoenixServer.html) server:

```
ansible-playbook ops/site.yml
```

- To setup infrastructure only:

```
ansible-playbook ops/infra.yml
```

- To setup `OpenTermsArchive` app only:

```
ansible-playbook ops/app.yml
```

Setting up the production infrastructure for publishing on the shared versions repository entails decrypting a private key managed with [Ansible Vault](https://docs.ansible.com/ansible/latest/user_guide/vault.html). It is decrypted with a password that we keep safe. You do not need to decrypt this specific private key on your own production server.

**Note that executing playbook on production inventory will affect all production servers.**

If you want to execute a playbook on a specific server you have to add the `--limit` option to your command with the `hostname` as parameter:

```
ansible-playbook --inventory ops/inventories/production.yml ops/site.yml --limit <hostname>
```

The hostname is the one defined in the `ops/inventories/production.yml` inventory file.

### Tags

Some tags are available to refine what will happen, use them with `--tags`:

- `setup`: to only setup system dependencies required by the app (cloning repo, installing app dependencies, all config files, and so on…)
- `start`: to start the app
- `stop`: to stop the app
- `restart`: to restart the app
- `update`: to update the app (pull code, install dependencies and restart app)
- `update-declarations`: to update services declarations (pull declarations, install dependencies and restart app)

For example, you can update `OpenTermsArchive` by running:

```
ansible-playbook ops/app.yml --tags update
```

### Logs

You can get logs by connecting to the target machine over SSH and obtaining logs from the process manager:

```
ssh user@machine pm2 logs ota
```

### Troubleshooting

If you have the following error:

```
Failed to connect to the host via ssh: ssh: connect to host 127.0.0.1 port 2222: Connection refused
```

You may have a collision on the default port `2222` used by vagrant to forward ssh commands.
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

Modify ansible ssh options to the `ops/inventories/dev.yml` file with the proper `ansible_ssh_port`:

```
all:
  children:
    dev:
      hosts:
        '127.0.0.1':
          […]
          ansible_ssh_port: 2200
          […]
```

## Process

To avoid breaking the production when making changes you can follow this process:
- Start by applying your changes on your Vagrant virtual machine
  `ansible-playbook ops/site.yml`.
- Connect through ssh to the virtual machine and check everything is OK
  `vagrant ssh`, `pm2 logs`…
- **As you will test the PRODUCTION environnement, stop the OTA application server to avoid sending mail to our users**
  `ansible-playbook ops/app.yml -t stop`
- If everything works, destroy that machine and re-run the entire installation on a clean machine to ensure that your changes are not based on something pre-existing
  `vagrant destroy && vagrant up && ansible-playbook ops/site.yml`
- Re check everything is OK
  `vagrant ssh`, `pm2 logs`…
- Then you can now deploy changes on production
  `ansible-playbook -i ops/inventories/production.yml ops/site.yml`.

## Initialize new instance

### Provision a server

If you use [OVH Horizon](https://horizon.cloud.ovh.net/project/instances/), click on `Launch Instance` button. Then fill, at least, following fields:
  - `Instance name`
  - `Source`. Suggested: `Debian 11`
  - `Flavor`. Suggested: `b2-30-flex`
  - `Key pair`. Suggested: Your own personnal SSH key, to allow you to connect on the freshly created server
### Add host configuration

Add entry to the production inventory file `ops/inventories/production.yml` for the created host with the server address and proper variables.
### Create repositories

Create the snapshot and version repositories, with :
- A master branch
- The master branch should be the default branch
- At least one commit on this branch with some content (README.md template preferred, it would be nice to put a LICENSE too)
