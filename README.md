# Grouping

Grouping a solidity based ethereum contract application built for a Master Thesis in Computer Science titled `Secure Random Grouping for Blockchain based Voting`.

## Setup

Spin up a local blockchain using `ganache`. Download the app and create a new blockchain.
Set the number of accounts to at least 13.

Make sure you have `node v10.5.0`, otherwise get `nvm` and run
```
nvm install 10.5
```

Also have `truffle` installed:
```
npm i -g truffle@latest
```

Install dependencies
```
npm install
```

You need to have the `ethereum-bridge` running to communicate with the provable oracle
```
npx ethereum-bridge -a 9 -H 127.0.0.1 -p 7545 --dev
```
Add for example `--oar 0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475` if you ran the command above before and want to use the same address as stated below:

The bridge will print out the address of the oracle contract.

```
OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
```

Copy paste it into the constructor function of the contract `ShuffleAndRoundRobin` so that it knows where to connect.

## Test
To execute tests you can run
```
truffle test
```

To get debug events shown
```
truffle test --show-events
```

## Run
To run it simply execute
```
truffle migrate
```