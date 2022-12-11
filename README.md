# @codemucker/merge

Configurable npm/yar/pnpm cli tool to run tasks to merge various failes as part of a build/install/distribution

## usage

install the package '@codemucker/merge' as a 'dev' dependency

```sh
pnpm install --save-dev @codemucker/merge
```

```sh
npm install --save-dev @codemucker/merge
```

```sh
yarn add --save-dev @codemucker/merge
```

In your script block call:

```sh
codemucker-merge <global-options> [command] <command-options>
```

for the 'run' command:

```sh
codemucker-merge <global-options> run [config] <command-options>
```

as in:

```sh
codemucker-merge --log-level debug run @codemucker/merge/dist --dry-run
```

where '@codemucker/merge/dist' is the path to the config node

or the shortest:

```sh
codemucker-merge run dist
```

where 'dist' is prefixed with '@codemucker/merge/' by default

In your 'package.json/scripts', you could add an entry

```json
scripts:{
    //WARNING! this will apply the @codemucker defaults to your project files! Do this after saving all your changes in git first, and checking your are happy with the modifications
    "postinstall":"pnpm codemucker-merge run @codemucker/merge/install" 
    //this wil apply teh @codemucker defaults for distribution pakages
    "build:dist":"pnpm codemucker-merge run @codemucker/merge/dist"
}
```

For more options, run

```sh
codemucker-merge help
```
