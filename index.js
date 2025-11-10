import { Command } from "commander";
const program = new Command();

program
  .requiredOption("-h, --host <host>", "server host address")
  .requiredOption("-p, --port <port>", "server port")
  .requiredOption("-c, --cache <path>", "path to cache directory");

program.parse(process.argv);

const options = program.opts();
console.log("Server options:", options);
