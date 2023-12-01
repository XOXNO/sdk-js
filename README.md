# XOXNO SDK

XOXNO SDK is a JavaScript library that simplifies the interaction with the XOXNO Protocol for developers. It includes a set of helper functions and modules that make it easy to fetch, filter, and interact with data from the XOXNO Protocol and its NFT marketplace.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#docs)

## Installation

To install the XOXNO SDK, simply run the following command in your project's root directory:

```bash
npm i @xoxno/sdk-js
```

## Usage

The SDK follows a scheleton model where the API configuration has to be initiated only once anywhere in your application

```javascript
import { XOXNOClient } from '@xoxno/sdk-js';
XOXNOClient.init();
// By default calling init() without arguments will set the entire SDK to the mainnet ENV using the public API https://api.xoxno.com
```

After the client has been created you can now import different modules anywhere in the application:

```javascript
import { CollectionModule } from '@xoxno/sdk-js';
const collection = new CollectionModule(); // In case the above .init() call was not set before creating any module instance will auto trigger .init() using the default parameters described above
const profile = await collection.getCollectionProfile('MONKEY-ac9bdf');
// or similar with 
const profile = await new CollectionModule().getCollectionProfile('MONKEY-ac9bdf');
```

## Docs

For more modules and typescript interfaces you can check our documentation at [https://sdk.xoxno.com](https://sdk.xoxno.com)