# Zoom Room Control Profile Editor

## Overview

A builder, validator, and preview tool for [Zoom Native Room Controls](https://support.zoom.us/hc/en-us/articles/360033716572-Zoom-Rooms-Native-Room-Controls) profiles. Lets you compose a control profile, see schema/cross-reference errors as you type, and preview the rendered Zoom Room control surface side by side.

## Attribution

This project is a fork of [`zoom-native-room-controls-preview`](https://github.com/jeffderek/zoom-native-room-controls-preview) by [Jeff McAleer](https://www.jeffmcaleer.com), used under the MIT License.

## Development

```sh
npm install
npm run dev
```

`npm run build` produces a static bundle in `dist/`.

### Stack

- Vue 3 (Composition + Options API)
- Vite 6
- AJV 8 (JSON Schema validation)
- Sass (modern `@use` module system)

## AI Disclosure

Portions of this software were developed or modified with the assistance of an artificial intelligence agent.

## License

> MIT License
> 
> Copyright (c) 2022 Jeff McAleer
> 
> Copyright (c) 2026 Spectrum Integrators
> 
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
> 
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
> 
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
