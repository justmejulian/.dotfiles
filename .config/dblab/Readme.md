# dblab

Create a new dblab config and then create a simlink to the .dblab.yaml file in the home directory.

```bash
ln -s ~/.config/dblab/.dblab.yaml ~/.dblab.yaml
```

See https://github.com/danvergara/dblab

Config file: https://dblab.danvergara.com/tutorials/config-file/

## Create simlink

```bash
ssh -L localhost:5432:0.0.0.0:5432 hostname
```
_hostname_ should be configured in ~/.ssh/config

Example:
```bash
❯ ssh -L localhost:5432:0.0.0.0:5432 user-api 
root@node136247-user-api ~ $ docker ps | grep user-api-db-1
1e830c277d17   postgres                                             "docker-entrypoint.s…"   19 hours ago   Up 19 hours (healthy)   0.0.0.0:5432->5432/tcp, :::5432->5432/tcp        user-api-db-1
```
