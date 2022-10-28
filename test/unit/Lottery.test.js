const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { developmentChainIDs, networkConfig } = require("../../helper-hardhat-config")

const chainId = network.config.chainId

!developmentChainIDs.includes(chainId)
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          let lottery, vrfCoordinatorV2Mock, entranceFee, deployer, interval

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              lottery = await ethers.getContract("Lottery")
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
              entranceFee = await lottery.getEntranceFee()
              interval = await lottery.getInterval()
          })

          describe("constructor", function () {
              it("initializes lottery correctly", async function () {
                  const lotteryState = await lottery.getLotteryState()
                  const gasLane = await lottery.getGasLane()
                  const callbackGasLimit = await lottery.getCallbackGasLimit()

                  assert.equal(lotteryState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
                  assert.equal(entranceFee.toString(), networkConfig[chainId]["entranceFee"])
                  assert.equal(gasLane.toString(), networkConfig[chainId]["gasLane"])
                  assert.equal(
                      callbackGasLimit.toString(),
                      networkConfig[chainId]["callbackGasLimit"]
                  )
              })
          })

          describe("enterLottery", function () {
              it("revert when you don't pay enough", async function () {
                  const paymentValue = ethers.utils.parseEther("0.001")
                  assert.isAbove(entranceFee, paymentValue)
                  await expect(lottery.enterLottery({ value: paymentValue })).to.be.revertedWith(
                      "Lottery__NotEnoughETHEntered"
                  )
              })

              it("records players when they enter", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  const playerFromContract = await lottery.getPlayer(0)
                  assert(playerFromContract, deployer)
              })

              it("emits event on enter", async function () {
                  await expect(lottery.enterLottery({ value: entranceFee })).to.emit(
                      lottery,
                      "LotteyEntered"
                  )
              })

              it("doesn't allow entrance when lottery is calculating", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // Pretend that Chainlink network keeper was triggered
                  await lottery.performUpkeep([])
                  await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
                      "Lottery__NotOpen"
                  )
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if people haven't send any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded, _ } = await lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("returns false if lottery isn't open", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await lottery.performUpkeep([])
                  const { upkeepNeeded, _ } = await lottery.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, false)
              })

              it("returns true if time has passed, lootery open and people send enough ETH", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded, _ } = await lottery.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, true)
              })
          })

          describe("performUpkeep", function () {
              it("it can only run when checkUpkeed is true", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponce = lottery.performUpkeep([])
                  assert(txResponce)
              })

              it("reverts when check upkeep is false", async function () {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith(
                      "Lottery__UpkeepNotNeeded"
                  )
              })

              it("updates lottery state, emits event, calls vrf coordinator", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponce = await lottery.performUpkeep([])
                  const txReciept = await txResponce.wait(1)
                  const requestId = txReciept.events[1].args.requestId
                  const lotteryState = await lottery.getLotteryState()
                  assert(requestId.toNumber() > 0)
                  assert.equal(lotteryState.toString(), "1")
              })
          })

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("picks a winner, resets the lottery and sends money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 // deployer = 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedLottery = lottery.connect(accounts[i])
                      await accountConnectedLottery.enterLottery({ value: entranceFee })
                  }

                  const startingTimeStamp = await lottery.getLastTimeStamp()

                  await new Promise(async (resolve, reject) => {
                      // Setting up the listener
                      lottery.once("WinnerPicked", async () => {
                          try {
                              const lotteryState = await lottery.getLotteryState()
                              const winnerBalance = await accounts[1].getBalance()
                              const endingTimeStamp = await lottery.getLastTimeStamp()
                              const numPlayers = await lottery.getNumberOfPlayers()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(lotteryState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance // startingBalance + ( (entranceFee * additionalEntrants) + entranceFee )
                                      .add(entranceFee.mul(additionalEntrants).add(entranceFee))
                                      .toString()
                              )
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })
                      // Fire up event, listener will pick it up and resolve
                      const txResponce = await lottery.performUpkeep([])
                      const txReciept = await txResponce.wait(1)
                      const startingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReciept.events[1].args.requestId,
                          lottery.address
                      )
                  })
              })
          })
      })
