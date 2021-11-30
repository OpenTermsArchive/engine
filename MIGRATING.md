## 2021-02-24 Name change

`CGUs` is now called `OpenTermsArchive`.

To reflect this change, if you already have this project on your local, go to the given folder and execute:

```
    cd ..
    mv CGUs OpenTermsArchive
    cd OpenTermsArchive
    git remote set-url origin https://github.com/ambanum/OpenTermsArchive.git
```

## 2021-11-25 Externalize services declarations

Services declarations are now declared in their [own repository](https://github.com/OpenTermsArchive/services-all).

In order to use all the defined services locally, you now have to clone this repository:

```
    cd ..
    git clone git@github.com:OpenTermsArchive/services-all.git
```
