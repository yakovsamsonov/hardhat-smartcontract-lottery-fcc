const { network, ethers } = require("hardhat")
const { developmentChainIDs } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") // cost of each request to the oracle, e.g. 0.25 LINK per request
const GAS_PRICE_LINK = 1e9

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentChainIDs.includes(network.config.chainId)) {
        log("Local network detected! Deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("Mocks deployed!")
        log("____________________________________________________________")
    }
}

module.exports.tags = ["all", "mocks"]
