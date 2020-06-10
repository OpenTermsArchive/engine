# CGUs-ops

Recipes to set up the infrastructure for the CGUs app and deploy it.

> Recettes pour mettre en place l'infrastructure et déployer l'application CGUs

## Requirements

- Install [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

### [For developement only] Additional dependencies

To test the changes without impacting the production server, a Vagrantfile is provided to test the changes locally in a virtual machine. VirtualBox and Vagrant are therefore required.

- Install [VirtualBox](https://www.vagrantup.com/docs/installation/)
- Install [Vagrant](https://www.vagrantup.com/docs/installation/)

## Usage

To avoid making changes on the production server by mistake, by default all commands will only affect the Vagrant development virtual machine (VM). Note that the VM needs to be started before with `vagrant up`.\
To execute commands on the production server you should specify it by adding the option `-i ops/inventories/production.yml` to the following commands:

- To setup a full [(phoenix)](https://martinfowler.com/bliki/PhoenixServer.html) server:
```
ansible-playbook ops/site.yml
```

- To setup infrastructure only:
```
ansible-playbook ops/infra.yml
```

- To setup `CGUs` app only:
```
ansible-playbook ops/app.yml
```

Some useful options can be used to:
- see what changed with `--diff`
- simulate execution with `--check`
- see what will be changed with `--check --diff`

### Tags

Some tags are available to refine what will happen, use them with `-t`:
 - `setup`: to only setup system dependencies required by the app (cloning repo, installing app dependencies, all config files, and so on…)
 - `start`: to start the app
 - `stop`: to stop the app
 - `restart`: to restart the app
 - `update`: to update the app (pull code, install dependencies and restart app)

For example, you can update `CGUs` by running:
```
ansible-playbook ops/app.yml -t update
```

### Troubleshooting

If you have the following error:

```
Failed to connect to the host via ssh: Received disconnect from 127.0.0.1 port 2222:2: Too many authentication failures
```

Modify ansible ssh options to the `ops/inventories/dev.yml` file like this:
```
all:
  children:
    dev:
      hosts:
        '127.0.0.1':
          […]
          ansible_ssh_private_key_file: .vagrant/machines/default/virtualbox/private_key
          ansible_ssh_extra_args: -o StrictHostKeyChecking=no -o IdentitiesOnly=yes
          […]
```
