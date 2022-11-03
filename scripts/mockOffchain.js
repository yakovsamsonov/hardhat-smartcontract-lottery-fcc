const { ethers, network } = require("hardhat")
const { developmentChainIDs } = require("../helper-hardhat-config")
const helpers = require("@nomicfoundation/hardhat-network-helpers")

const chainId = network.config.chainId

async function mockKeepers() {
    const lottery = await ethers.getContract("Lottery")
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
    const lotteryState = await lottery.getLotteryState()
    const lastTimeStamp = await lottery.getLastTimeStamp()
    const interval = await lottery.getInterval()
    const blockTime = await helpers.time.latest()
    const lotteryBalance = await lottery.provider.getBalance(lottery.address)
    console.log(`Using lottery with address: ${lottery.address}`)
    console.log(`Lottery state: ${lotteryState}`)
    console.log(`Contract timestamp: ${lastTimeStamp}`)
    console.log(`Last block timestamp: ${blockTime}`)
    console.log(`Interval: ${interval}`)
    console.log(`Lottery balance: ${lotteryBalance}`)
    await network.provider.send("evm_mine", [])
    const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(checkData)
    if (upkeepNeeded) {
        const tx = await lottery.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        console.log(`Performed upkeep with RequestId: ${requestId}`)
        if (developmentChainIDs.includes(chainId)) {
            await mockVrf(requestId, lottery)
        }
    } else {
        console.log("No upkeep needed!")
    }
}

async function mockVrf(requestId, lottery) {
    console.log("We on a local network? Ok let's pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, lottery.address)
    console.log("Responded!")
    const recentWinner = await lottery.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
