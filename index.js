import { config } from "dotenv";
import { ethers } from "ethers";
import solc from "solc";
import chalk from "chalk";
import ora from "ora";
import cfonts from "cfonts";
import readlineSync from "readline-sync"; // For user input

config(); // Load environment variables

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;

if (!PRIVATE_KEY || !RPC_URL) {
    console.log(chalk.red.bold("❌ Вы не добавили приватный ключ!"));
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contractSource = `
pragma solidity ^0.8.0;

contract Counter {
    uint256 private count;
    
    event CountIncremented(uint256 newCount);
    
    function increment() public {
        count += 1;
        emit CountIncremented(count);
    }
    
    function getCount() public view returns (uint256) {
        return count;
    }
}
`;

function compileContract() {
    const spinner = ora("Compiling contract...").start();

    try {
        const input = {
            language: "Solidity",
            sources: { "Counter.sol": { content: contractSource } },
            settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } }
        };

        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        const contract = output.contracts["Counter.sol"].Counter; 

        spinner.succeed(chalk.green("Contract compiled successfully!"));
        return { abi: contract.abi, bytecode: contract.evm.bytecode.object };
    } catch (error) {
        spinner.fail(chalk.red("Contract compilation failed!"));
        console.error(error);
        process.exit(1);
    }
}

async function deploy() {
    // Ask user for number of deployments
    const numDeployments = parseInt(readlineSync.question("Сколько раз задеплоить: "), 10);

    if (isNaN(numDeployments) || numDeployments <= 0) {
        console.log(chalk.red.bold("❌ Неправильная цифра! Введите пожалуйста положительное число."));
        process.exit(1);
    }

    console.log(chalk.blue.bold(`\n🚀 Деплоим ${numDeployments} контракты...\n`));

    const { abi, bytecode } = compileContract();

    for (let i = 0; i < numDeployments; i++) {
        const spinner = ora(`Deploying contract ${i + 1}/${numDeployments}...`).start();
        try {
            const factory = new ethers.ContractFactory(abi, bytecode, wallet);
            const contract = await factory.deploy();

            console.log("⏳ Ждем подтверждение транзакции...");
            const txReceipt = await contract.deploymentTransaction().wait();

            spinner.succeed(chalk.green(`Contract ${i + 1} deployed successfully!`));
            console.log(chalk.cyan.bold(`📌 Contract Address ${i + 1}: `) + chalk.yellow(contract.target));
            console.log(chalk.cyan.bold(`📜 Transaction Hash ${i + 1}: `) + chalk.yellow(txReceipt.hash));
        } catch (error) {
            spinner.fail(chalk.red(`Deployment ${i + 1} failed!`));
            console.error(error);
        }
    }

    console.log(chalk.green("\n✅ Все контракты были задеплоены! 🎉\n"));
}

deploy().catch(console.error);
