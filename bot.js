require("dotenv").config();
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const Web3 = require("web3");
const WebSocket = require('ws');
const fetch = require('node-fetch');

let web3, tradeData = [], nftRewardsDataV6 = [], nftRewardsDataV5 = [];

const WSS_URL = process.env.WSS_URL;
const MY_BOTS = process.env.MY_BOTS.toLowerCase();
const MY_BOTS_ENDPOINT = process.env.MY_BOTS_ENDPOINT;

start();
let blockNumberStart;
async function start() {
	web3 = new Web3(WSS_URL);
	blockNumberStart = await web3.eth.getBlockNumber();
}

const v6FirstBlock = 25002694;
async function subscribe(fromBlock, toBlock = null, shouldLog = true) {
	let rOptions = {
		address: "0xd7052ec0fe1fe25b20b7d65f6f3d490fce58804f",
		topics: ['0xfe3518e5e73f574892bc6ff79a4ac4816e01c14b62127612ca3aa45667db361b'],
		fromBlock: web3.utils.toHex(fromBlock)
	}
	if (toBlock) {
		rOptions.toBlock = web3.utils.toHex(toBlock);
	}

	const rSubscription = web3.eth.subscribe('logs', rOptions, (err, res) => {
		if (err) console.error(err);
	});
	rSubscription.on('data', (logs) => {
		recievedFromTrader(logs, shouldLog);
	});

	let sOptions = {
		address: "0xd7052ec0fe1fe25b20b7d65f6f3d490fce58804f",
		topics: ['0x80b773cd8ea3bf97475bccfb129d2ad177499dd4b091fbf87669b370fffef58c'],
		fromBlock: web3.utils.toHex(fromBlock)
	}
	if (toBlock) {
		sOptions.toBlock = web3.utils.toHex(toBlock);
	}
	const sSubscription = web3.eth.subscribe('logs', sOptions, (err, res) => {
		if (err) console.error(err);
	});
	sSubscription.on('data', (logs) => {
		sendDaiToTrader(logs, shouldLog);
	});

	let tOptions = {
		address: "0x37c11410b2c2a1cd4b3a0de2bd3a1808e0528ebe",
		topics: ['0x3adaa586cdbe84dd24e45bd7dada6da933d7c2d1c7b4e4cd02fce033356decb1'],
		fromBlock: web3.utils.toHex(fromBlock)
	}
	if (toBlock) {
		tOptions.toBlock = web3.utils.toHex(toBlock);
	}
	const tSubscription = web3.eth.subscribe('logs', tOptions, (err, res) => {
		if (err) console.error(err);
	});
	tSubscription.on('data', (logs) => {
		sendDaiToTraderTimeout(logs, shouldLog);
	});

	let nftPoptions = {
		address: "0x3470756e5b490a974bc25feeeeb24c11102f5268",
		topics: ['0x46ac8a38885612f1237f564a5c0956490dfd5f8e749e750a4c28fafb9f4e6f3a'],
		fromBlock: web3.utils.toHex(fromBlock)
	}
	if (toBlock) {
		nftPoptions.toBlock = web3.utils.toHex(toBlock);
	}
	const nftPsubscription = web3.eth.subscribe('logs', nftPoptions, (err, res) => {
		if (err) console.error(err);
	});
	nftPsubscription.on('data', (logs) => {
		addNftPoolRewards(logs, shouldLog);
	});

	let nftCOotions = {
		address: "0x3470756e5b490a974bc25feeeeb24c11102f5268",
		topics: ['0x896e034966eaaf1adc54acc0f257056febbd300c9e47182cf761982cf1f5e430'],
		fromBlock: web3.utils.toHex(fromBlock)
	}
	if (toBlock) {
		nftCOotions.toBlock = web3.utils.toHex(toBlock);
	}
	const nftCsubscription = web3.eth.subscribe('logs', nftCOotions, (err, res) => {
		if (err) console.error(err);
	});
	nftCsubscription.on('data', (logs) => {
		addNftClaimRewards(logs, shouldLog);
	});
/*
	let nftLotions = {
		address: "0xb0897686c545045afc77cf20ec7a532e3120e0f1",
		topics: ['0xe19260aff97b920c7df27010903aeb9c8d2be5d310a2c67824cf3f15396e4c16'],
		fromBlock: web3.utils.toHex(fromBlock)
	}
	if (toBlock) {
		nftLOotions.toBlock = web3.utils.toHex(toBlock);
	}
	const nftLsubscription = web3.eth.subscribe('logs', nftLotions, (err, res) => {
		if (err) console.error(err);
	});
	nftLsubscription.on('data', (logs) => {
		addNftClaimRewards(logs, shouldLog);
	});
*/
	return {
		rSubscription: rSubscription,
		sSubscription: sSubscription,
		tSubscription: tSubscription,
		nftPsubscription: nftPsubscription,
		nftCsubscription: nftCsubscription
		//nftLsubscription: nftLsubscription
	}
}

let lastBackfillFromBlock = 0;
async function backfill() {
	let toBlock = blockNumberStart - 1;
	if(lastBackfillFromBlock) {
		toBlock = lastBackfillFromBlock - 1;
	}
	lastBackfillFromBlock = toBlock - backfillBlockInterval;
	console.log("toBlock: " + toBlock + " lastBackfillFromBlock: " + lastBackfillFromBlock)
	return await subscribe(lastBackfillFromBlock, toBlock, false);
}
let subs = null, backfillCount = 0, backfillAtempts = 900, backfillInterval = 5, backfillBlockInterval = 12000;
let alreadySubbed = false, backfillComplete = false
setInterval(async () => {
	if (backfillCount < backfillAtempts) {
		subs = await backfill();
	} else {
		backfillComplete = true
	}
	if(backfillComplete && !alreadySubbed) {
		alreadySubbed = true;
		web3.eth.clearSubscriptions();
		subscribe(blockNumberStart);
		subs = null;
	}
	unsubSubs(subs);
	backfillCount++;
}, backfillInterval * 1000);

function unsubSubs(subs) {
	setTimeout(async () => {
		if (subs) {
			subs.rSubscription.unsubscribe();
			subs.sSubscription.unsubscribe();
			subs.tSubscription.unsubscribe();
			subs.nftPsubscription.unsubscribe();
			subs.nftCsubscription.unsubscribe();
			//subs.nftLsubscription.unsubscribe();
		}
	}, backfillInterval / 2 * 1000);
}

//open trade event
function recievedFromTrader(logs, shouldLog) {
	const params = [{type: 'address',name: 'caller'}, {type: 'address',name: 'trader'}, {type: 'uint256',name: 'daiAmount'}, {type: 'uint256',name: 'vaultFeeDai'}, {type: 'uint256',name: 'newCurrentBalanceDai'}, {type: 'uint256',name: 'maxBalanceDai'}];
	const dParams = web3.eth.abi.decodeParameters(params, logs.data);
	//console.log(dParams);

	const trader = dParams.trader;
	const diaAmount = -Math.abs(parseFloat(dParams.daiAmount));
	if(shouldLog) {
		console.log("recievedFromTrader: " + trader + " amount: " + Math.round(diaAmount / 1e18));
	}
	tradeDataUpdate(trader, diaAmount, logs.blockNumber, true);
}

//close trade event
function sendDaiToTrader(logs, shouldLog) {
	const params = [{type: 'address',name: 'caller'}, {type: 'address',name: 'trader'}, {type: 'uint256',name: 'amount'}, {type: 'uint256',name: 'newCurrentBalanceDai'}, {type: 'uint256',name: 'maxBalanceDai'}];
	const dParams = web3.eth.abi.decodeParameters(params, logs.data);
	//console.log(dParams);

	const trader = dParams.trader;
	const diaAmount = parseFloat(dParams.amount);
	if(shouldLog) {
		console.log("sendDaiToTrader: " + trader + " amount: " + Math.round(diaAmount / 1e18));
	}
	tradeDataUpdate(trader, diaAmount, logs.blockNumber);
}

//timeout claim
function sendDaiToTraderTimeout(logs, shouldLog) {
	const params = [{type: 'uint256',name: 'a'}, {type: 'address',name: 'trader'}, {type: 'uint256',name: 'b'}, {type: 'uint256',name: 'c'}, {type: 'uint256',name: 'd'}, {type: 'uint256',name: 'amount'}, {type: 'uint256',name: 'e'}, {type: 'uint256',name: 'f'}, {type: 'uint256',name: 'g'}, {type: 'uint256',name: 'h'}, {type: 'uint256',name: 'i'}, {type: 'uint256',name: 'j'}, {type: 'uint256',name: 'k'}, {type: 'uint256',name: 'l'}, {type: 'uint256',name: 'm'}, {type: 'uint256',name: 'n'}];
	const dParams = web3.eth.abi.decodeParameters(params, logs.data);
	//console.log(dParams);

	const trader = dParams.trader;
	const diaAmount = parseFloat(dParams.amount);
	if(shouldLog) {
		console.log("sendDaiToTraderTimeout: " + trader + " amount: " + Math.round(diaAmount / 1e18));
	}
	tradeDataUpdate(trader, diaAmount, logs.blockNumber);
}

function tradeDataUpdate(address, amount, blockNumber, shouldAdd=false) {
	let found = false;
	for (var i = 0; i < tradeData.length; i++) {
		if (tradeData[i].address.toLowerCase() == address.toLowerCase()) {
			tradeData[i].amount = tradeData[i].amount + amount;
			tradeData[i].tradeCount = shouldAdd ? tradeData[i].tradeCount + 1 : tradeData[i].tradeCount;
			tradeData[i].lastTradeBlock = blockNumber > tradeData[i].lastTradeBlock ? blockNumber : tradeData[i].lastTradeBlock;
			return;
		}
	}
	if (!found) {
		tradeData.push({
			address: address.toLowerCase(),
			amount: amount,
			tradeCount: shouldAdd ? 1 : 0,
			lastTradeBlock: blockNumber
		})
	}
}

function addNftPoolRewards(logs, shouldLog) {
	const params = [{type: 'address',name: 'address'}, {type: 'uint256',name: 'fromRound'}, {type: 'uint256',name: 'toRound'}, {type: 'uint256',name: 'amount'}];
	const dParams = web3.eth.abi.decodeParameters(params, logs.data);
	//console.log(dParams);

	const address = dParams.address;
	const gnsAmount = parseFloat(dParams.amount);
	if(shouldLog) {
		console.log("addNftPoolRewards: " + address + " amount: " + Math.round(gnsAmount / 1e18));
	}
	nftRewardsDataV6Update(address, 0, gnsAmount, 0, logs.blockNumber);
}

function addNftClaimRewards(logs, shouldLog) {
	const params = [{type: 'address',name: 'address'}, {type: 'uint256',name: 'amount'}];
	const dParams = web3.eth.abi.decodeParameters(params, logs.data);
	//console.log(dParams);

	const address = dParams.address;
	const gnsAmount = parseFloat(dParams.amount);
	if(shouldLog) {
		console.log("addNftClaimRewards: " + address + " amount: " + Math.round(gnsAmount / 1e18));
	}
	nftRewardsDataV6Update(address, gnsAmount, 0, 0, logs.blockNumber);
}

//not in use
function addLink(logs, shouldLog) {
	const params = [{type: 'address',name: 'address'}, {type: 'uint256',name: 'amount'}];
	const dParams = web3.eth.abi.decodeParameters(params, logs.data);
	//console.log(dParams);

	const address = dParams.address.toLowerCase();
	const gnsAmount = parseFloat(dParams.amount);
	if(shouldLog) {
		console.log("addLink: " + address + " amount: " + Math.round(gnsAmount / 1e18));
	}
	nftRewardsDataV6Update(address.toLowerCase(), 0, gnsAmount, 0, logs.blockNumber);
}

//not in use
function nftRewardsDataV5Update(address, amount, linkAmount, blockNumber) {
	let found = false;
	for (var i = 0; i < nftRewardsDataV5.length; i++) {
		if (nftRewardsDataV5[i].address.toLowerCase() == address.toLowerCase()) {
			nftRewardsDataV5[i].amount = nftRewardsDataV5[i].amount + amount;
			nftRewardsDataV5[i].linkAmount = nftRewardsDataV5[i].linkAmount + linkAmount;
			nftRewardsDataV5[i].lastTradeBlock = blockNumber > nftRewardsDataV5[i].lastTradeBlock ? blockNumber : nftRewardsDataV5[i].lastTradeBlock;
			return;
		}
	}
	if (!found) {
		nftRewardsDataV5.push({
			address: address.toLowerCase(),
			amount: amount,
			linkAmount: linkAmount,
			lastTradeBlock: blockNumber
		})
	}
}

function nftRewardsDataV6Update(address, claimAmount, poolAmount, linkAmount, blockNumber) {
	let found = false;
	for (var i = 0; i < nftRewardsDataV6.length; i++) {
		if (nftRewardsDataV6[i].address.toLowerCase() == address.toLowerCase()) {
			nftRewardsDataV6[i].claimAmount = nftRewardsDataV6[i].claimAmount + claimAmount;
			nftRewardsDataV6[i].poolAmount = nftRewardsDataV6[i].poolAmount + poolAmount;
			nftRewardsDataV6[i].linkAmount = nftRewardsDataV6[i].linkAmount + linkAmount;
			nftRewardsDataV6[i].lastTradeBlock = blockNumber > nftRewardsDataV6[i].lastTradeBlock ? blockNumber : nftRewardsDataV6[i].lastTradeBlock;
			return;
		}
	}
	if (!found) {
		nftRewardsDataV6.push({
			address: address.toLowerCase(),
			claimAmount: claimAmount,
			poolAmount: poolAmount,
			linkAmount: linkAmount,
			lastTradeBlock: blockNumber
		})
	}
}

// CREATE SERVER (USEFUL FOR CLOUD PLATFORMS)
const port = process.env.PORT || 8080;
server.listen(port, () => console.log(`Listening on port ${port}`));

app.get('/', async (req, res) => {
	const printString = "Trader profits to backfilled block. <br/>" + getBackfillString() + tradeDataStringify();
	res.send(printString);
})

function tradeDataStringify() {
	tradeData.sort(function(a, b) {
		return b.amount - a.amount;
	});
	let printString = "";
	for(var i = 0; i < tradeData.length; i++) {
		const tData = tradeData[i];
		const profit = Math.round(tData.amount / 1e18 * 100) / 100;
		const averageProfitPerTrade = Math.round((profit/(tData.tradeCount)) * 100) / 100;
		printString = printString + i + ".   trader:  " + tData.address + "  tradeCount:  " + tData.tradeCount + "  netProfit:  $" + profit + "  averageProfitPerTrade:  $" + averageProfitPerTrade + " lastTradeOnBlock: " + tData.lastTradeBlock + "<br/>";
	}
	return printString;
}

app.get('/nftRewards/', async (req, res) => {
	const printString = "V6 NFT Rewards. <br/> Add comma seperated list of address to the end of nftRewards/ to highlight and sum bot rewards <br/>" + getBackfillString() + nftRewardsDataV6Stringify();
	res.send(printString);
})

app.get('/' + MY_BOTS_ENDPOINT, async (req, res) => {
	const printString = "V6 NFT Rewards. <br/>" + getBackfillString() + nftRewardsDataV6Stringify(MY_BOTS);
	res.send(printString);
})

app.get('/nftRewards/:addresses', async (req, res) => {
	let addresses;
	if(req.params && req.params.addresses) {
		addresses = req.params.addresses.toLowerCase();
	}
	const printString = "V6 NFT Rewards. <br/>" + getBackfillString() + nftRewardsDataV6Stringify(addresses);
	res.send(printString);
})

function getBackfillString() {
	if(backfillCount < backfillAtempts) {
		return "Backfill in progress. ETA: " + ((backfillInterval * backfillAtempts) - (backfillInterval * backfillCount)).toString() + " seconds.<br/>";
	} else {
		return "Backfill complete to block " + lastBackfillFromBlock + ".<br/>"
	}
}

function nftRewardsDataV6Stringify(selectedAddresses=null) {
	nftRewardsDataV6.sort(function(a, b) {
		return (b.claimAmount + b.poolAmount) - (a.claimAmount + a.poolAmount);
	});
	let totalGns = 0, selectedAddressesTotal = 0, printString = "";
	for(var i = 0; i < nftRewardsDataV6.length; i++) {
		const nData = nftRewardsDataV6[i];
		const claimAmount = Math.round(nData.claimAmount / 1e18 * 100) / 100;
		const poolAmount = Math.round(nData.poolAmount / 1e18 * 100) / 100;
		totalGns = totalGns + nData.claimAmount + nData.poolAmount;
		let address = nData.address;
		if(selectedAddresses && selectedAddresses.includes(address)) {
			address = "<b>" + address + "</b>";
			selectedAddressesTotal = poolAmount + claimAmount + selectedAddressesTotal;
		}
		printString = printString + i + ".   bot:  " + address + "  GNS pool:  " + poolAmount + "  GNS claim:  " + claimAmount + "  GNS total:  " + Math.round((poolAmount + claimAmount) * 100) / 100 + "<br/>";
	}
	printString = printString + "Total GNS: " + Math.round(totalGns / 1e18 * 100) / 100 + "<br/>";
	if (selectedAddresses) {
		printString = "Selected bots % of total:  " + Math.round(selectedAddressesTotal / (totalGns  / 1e18) * 10000) / 100  + "%<br/>" + printString;
		printString = "Selected bots amount:  " + Math.round(selectedAddressesTotal * 100) / 100  + " GNS <br/>" + printString;
		printString = "Selected bots:  " + selectedAddresses + "<br/>" + printString;
	}
	return printString;
}

