## 2022-03-29 Unify repository names

All services declarations, snapshots and versions repo has been renamed and moved to the [OpenTermArchive organization](https://github.com/OpenTermsArchive) on github.

Documentation on the new naming system can be found [here](https://github.com/OpenTermsArchive/engine/blob/main/CONTRIBUTING.md#instances-and-repositories-names)

If you already have some of those projects locally, you can run

```
mv services-all contrib-declarations
mv services-dating dating-declarations
mv declarations-france-elections france-elections-declarations
mv declarations-france france-elections
mv declarations-france-elections-experiment france-elections-experiment-declarations
```

## 2021-11-25 Externalize services declarations

Services declarations are now declared in their [own repository](https://github.com/OpenTermsArchive/services-all).

In order to use all the defined services locally, you now have to clone that new repository in the parent folder of the OpenTermsArchive one:

```
    # From your local clone of the OpenTermsArchive repository
    cd ..
    git clone git@github.com:OpenTermsArchive/contrib-declarations.git
```

## 2021-02-24 Name change

`CGUs` is now called `OpenTermsArchive`.

To reflect this change, if you already have this project locally, execute:

```
    # From your local clone of the OpenTermsArchive repository
    cd ..
    mv CGUs OpenTermsArchive
    cd OpenTermsArchive
    git remote set-url origin https://github.com/OpenTermsArchive/engine.git
```

