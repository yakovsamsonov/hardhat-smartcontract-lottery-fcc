const { network, ethers } = require("hardhat")
const { developmentChainIDs, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("3")
    const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    log(`Connected to network: ${network.name}, chainId ${chainId}`)

    let vrfCoordinatorV2Contract, vrfCoordinatorV2Address, subscriptionId

    if (developmentChainIDs.includes(chainId)) {
        log("Using VRFCoordinatorV2Mock")
        vrfCoordinatorV2Contract = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Contract.address
        log("Create VRF Subsciption...")
        const transactionResponce = await vrfCoordinatorV2Contract.createSubscription()
        const transactionReciept = await transactionResponce.wait(1)
        subscriptionId = transactionReciept.events[0].args.subId
        log(`Subscription ID is ${subscriptionId}`)
        await vrfCoordinatorV2Contract.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
        log(`Funded subscription with ${ethers.utils.formatEther(VRF_SUB_FUND_AMOUNT)} ETH`)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        log(`Using VRFCoordinatorV2 at ${vrfCoordinatorV2Address}...`)
        subscriptionId = networkConfig[chainId]["subscriptionId"]
        log(`...with ${subscriptionId} subscriptionId`)
    }

    const arguments = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const lottery = await deploy("Lottery", {
        from: deployer,
        args: arguments, // put here constructor parameters
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log("______________________________________________")

    if (!developmentChainIDs.includes(chainId) && ETHERSCAN_API_KEY) {
        log(`Verifying ${lottery.address} contract on ${network.name} etherscan...`)
        await verify(lottery.address, arguments)
    }
    log("______________________________________________")

    if (developmentChainIDs.includes(chainId)) {
        await vrfCoordinatorV2Contract.addConsumer(subscriptionId, lottery.address)
        log(
            `Added ${lottery.address} consumer to vrfCoortanator at ${vrfCoordinatorV2Contract.address}`
        )
    }
    log("______________________________________________")
}

module.exports.tags = ["all", "lottery"]
