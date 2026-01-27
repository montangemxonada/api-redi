import bcrypt from "bcryptjs";

const pwd = process.argv[2];
if (!pwd) {
  console.error("Usage: npx tsx scripts/hashPassword.ts <password>");
  process.exit(1);
}

(async () => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(pwd, salt);
  console.log(hash);
})();
