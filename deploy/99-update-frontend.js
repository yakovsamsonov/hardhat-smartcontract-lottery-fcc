const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONTEND_CONTRACT_ADDRESSES_FILE =
    "../nextjs-smartcontract-lottery-fcc/constants/contractAddresses.json"
const FRONTEND_CONTRACT_ABI_FILE = "../nextjs-smartcontract-lottery-fcc/constants/abi.json"

module.exports = async () => {
    if (process.env.UPDATE_FRONTEND) {
        console.log("Updating frontend constants...")
        updateContractAddresses()
        updateAbi()
        console.log("Frontend updated")
        console.log("______________________________________________")
    }
}

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery")
    const data = lottery.interface.format(ethers.utils.FormatTypes.json)
    fs.writeFileSync(FRONTEND_CONTRACT_ABI_FILE, data)
}

async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery")
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_CONTRACT_ADDRESSES_FILE, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(lottery.address)) {
            currentAddresses[chainId].push(lottery.address)
        }
    } else {
        currentAddresses[chainId] = [lottery.address]
    }

    fs.writeFileSync(FRONTEND_CONTRACT_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"]
