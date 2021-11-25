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

Services declarations as now its [own repository](https://github.com/OpenTermsArchive/services-all).

You now have to clone this repository on your own to use all already defined services declaration on your local

```
    cd ..
    git clone git@github.com:OpenTermsArchive/services-all.git
```
