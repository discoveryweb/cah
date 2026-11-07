#!/usr/bin/env node
/**
 * Generates the scrypt hash that belongs in ADMIN_PASSWORD_HASH (or in
 * ADMIN_TEAM[].passwordHash). The plain password is read from an argument or
 * prompted for without echo; it is never written to disk or shell history when
 * prompted.
 *
 *   npm run admin:hash -- "a long passphrase"
 *   npm run admin:hash
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../server/admin-config.mjs";

const fromArgs = process.argv.slice(2).join(" ").trim();

const prompt = async (label) => {
  if (!process.stdin.isTTY) {
    throw new Error("گذرواژه را به‌صورت آرگومان بدهید یا در ترمینال اجرا کنید.");
  }
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(label);
  muted = true;
  const answer = await new Promise((resolve) => rl.question("", resolve));
  muted = false;
  rl.close();
  process.stdout.write("\n");
  return answer;
};

try {
  const password = fromArgs || (await prompt("گذرواژهٔ مدیر: "));
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`گذرواژه باید حداقل ${MIN_PASSWORD_LENGTH} نویسه باشد.`);
  }
  const hash = await hashPassword(password);
  console.log("\nADMIN_PASSWORD_HASH را در متغیرهای محیطی سرور قرار دهید:\n");
  console.log(hash);
  console.log("\nاین مقدار را جایی عمومی (مخزن، پیام، اسکرین‌شات) منتشر نکنید.\n");
} catch (error) {
  console.error(`خطا: ${error.message}`);
  process.exitCode = 1;
}
