# scratch-audio
#### Scratch audio engine is for playing sounds, instruments and audio effects in Scratch 3.0 projects

[![Greenkeeper badge](https://badges.greenkeeper.io/LLK/scratch-audio.svg)](https://greenkeeper.io/)

#### Please note this project is at an early stage and we are not ready for pull requests

[![CircleCI](https://circleci.com/gh/LLK/scratch-audio/tree/develop.svg?style=shield&circle-token=3792f4f51158c8c9b448527466ffe302b0c6f0f5)](https://circleci.com/gh/LLK/scratch-audio?branch=develop)

## Installation
This requires you to have Git and Node.js installed.

In your own node environment/application:
```bash
npm install https://github.com/scratchfoundation/scratch-audio.git
```
If you want to edit/play yourself:
```bash
git clone git@github.com:LLK/scratch-audio.git
cd scratch-audio
npm install
```

## Testing
```bash
npm test
```

## Donate
We provide [Scratch](https://scratch.mit.edu) free of charge, and want to keep it that way! Please consider making a [donation](https://secure.donationpay.org/scratchfoundation/) to support our continued engineering, design, community, and resource development efforts. Donations of any size are appreciated. Thank you!

## Committing

This project uses [semantic release](https://github.com/semantic-release/semantic-release) to ensure version bumps
follow semver so that projects depending on it don't break unexpectedly.

In order to automatically determine version updates, semantic release expects commit messages to follow the
[conventional-changelog](https://github.com/bcoe/conventional-changelog-standard/blob/master/convention.md)
specification.

You can use the [commitizen CLI](https://github.com/commitizen/cz-cli) to make commits formatted in this way:

```bash
npm install -g commitizen@latest cz-conventional-changelog@latest
```

Now you're ready to make commits using `git cz`.
