# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.hostname = "vagrant"

  config.vm.box = "debian/bullseye64" # Unable to locate package mongodb-org

  # in order to have the same config for both Docker and VirtualBox providers, we load the key manually
  # if necessary, create the key with `ssh-keygen -f ~/.ssh/ota-vagrant -q -N ""`
  # CAUTION: use of `~` in path causes problems with ssh
  config.vm.provision "file", source: File.join(ENV['HOME'], ".ssh", "ota-vagrant.pub"), destination: "/home/vagrant/.ssh/authorized_keys"

  # based on https://github.com/rofrano/vagrant-docker-provider#example-vagrantfile
  config.vm.provider :docker do |docker, override|
    override.vm.box = nil
    docker.image = "rofrano/vagrant-provider:debian"
    docker.remains_running = true
    docker.has_ssh = true
    docker.privileged = true
    docker.volumes = ["/sys/fs/cgroup:/sys/fs/cgroup:rw"]
    docker.create_args = ["--cgroupns=host"]

    # python is not installed by default in the vagrant-provider image
    # and deploying results in  /bin/sh: 1: /usr/bin/python: not found
    # use a provision to fix that
    # only with debian, no need with ubuntu
    # Also need to name the provisioner, so that it runs only once https://github.com/hashicorp/vagrant/issues/7685#issuecomment-308281283
    config.vm.provision "install_python3", type: "shell", inline: $installPython3
  end
end

$installPython3 = <<-SCRIPT
echo Updating apt...
sudo apt-get update --fix-missing # Needed to fix "No package matching 'chromium' is available"
echo Installing python...
sudo apt-get --assume-yes install python3 python3-pip
SCRIPT
