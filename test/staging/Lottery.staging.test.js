// 16.17.08

const { assert } = require("chai")
const { ethers, getNamedAccounts, network } = require("hardhat")
const { developmentChainIDs } = require("../../helper-hardhat-config")

const chainId = network.config.chainId

developmentChainIDs.includes(chainId)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
          let lottery, entranceFee, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract("Lottery")
              entranceFee = await lottery.getEntranceFee()
          })

          describe("fulfillRandomWords", function () {
              it("works live with Chainlink Keepers and Chainlink VRF", async function () {
                  const startingTimeStamp = await lottery.getLastTimeStamp()
                  const accounts = await ethers.getSigners()

                  // Setting up the listener
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          try {
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await lottery.getLastTimeStamp()
                              const numPlayers = await lottery.getNumberOfPlayers()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(lotteryState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(entranceFee).toString()
                              )
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      // Enter lottery after listener set up, otherwise we can missed event
                      await lottery.enterLottery({ value: entranceFee })
                      const winnerStartingBalance = await accounts[0].getBalance()
                  })
              })
          })
      })
