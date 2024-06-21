## linovel torchbearer

To bear the torch for [linovel](https://www.linovel.net)

### dependencies

```
node.js >= 20.14.0
npm >= 10.7.0
```

### usage

```shell
npm run ready
npm run start
```

#### if using pm2 you may use

```shell
pm2 start "npm run ready"
```

and when it's done you may
```shell
pm2 start "npm run start"
```

The integration of pm2 provides auto-restart for this project,
    in case network issues should occur.

If not working with pm2, you may still restart each job manually,
   by simply running it again when it exits out of error.


