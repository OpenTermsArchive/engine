# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "debian/buster64"
  config.vm.network "private_network", ip: "192.168.33.11"
  config.ssh.port = "2222"
  config.vm.define "ota"
  config.vm.hostname = "ota"
end
