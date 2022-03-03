# -*- mode: ruby -*-
# vi: set ft=ruby :

$installPython3 = <<-SCRIPT
echo Updating apt...
sudo apt-get update --fix-missing # Needed to fix "No package matching 'chromium' is available"
echo Installing python...
sudo apt-get install python3 python3-pip -y
SCRIPT

Vagrant.configure("2") do |config|
  config.vm.hostname = "vagrant"

  config.vm.box = "debian/bullseye64" # Unable to locate package mongodb-org

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
    # and depoying result in  /bin/sh: 1: /usr/bin/python: not found
    # use a provision to fix that
    # only with debian, no need with ubuntu
    config.vm.provision "shell", inline: $installPython3
  end
end
