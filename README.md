# lendroid-2-js

Javascript library for the protocol.2.0 smart contracts


## installation

```
yarn add lendroid-2-js
// or
npm install --save lendroid-2-js
```

for the specific versions check on [Releases](https://github.com/lendroidproject/lendroid-2-js/releases)

## how to use


```javascript
import { Lendroid } from 'lendroid-2-js'

const options = {
  provider: window.web3.currentProvider,
  [coming]: comingEvents,
}

const LendroidJS = new Lendroid(options)

// properties
const { ...properties } = LendroidJS

// methods
const methods = {
  [method]: LendroidJS['methodName'],
  ...methods,
}
```

## how to develop

- First clone repository and install dependencies (`npm install`)

  ------------
  Protocol | Command
  --- | ---
  HTTPS | `git clone https://github.com/lendroidproject/lendroid-js.git`
  SSH | `git clone git@github.com:lendroidproject/lendroid-js.git`
  --------------

- On UI, update `package.json` to use custom library as follow and install dependencies (`npm install`)

  ```
  "dependencies": {
    ...
    "lendroid-2-js": "../lendroid-2-js",
    ...
  }
  ```

- To update library, go to `lendroid-2-js` and run `tsc`

- Copy `dist` folder to `<path-to-ui>/node_modules/lendroid-2-js/`

## relations

- [Reloanr UI](https://github.com/lendroidproject/reloanr-ui)

- [Deployed](https://app.reloanr.com)
