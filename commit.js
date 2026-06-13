const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node commit.js "Commit message" "YYYY-MM-DD HH:MM:SS"');
  process.exit(1);
}

const [message, dateStr] = args;
const date = new Date(dateStr).toISOString();

console.log(`Committing: "${message}" at ${date}`);

try {
  execSync(`git commit -m "${message}"`, {
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Commit failed');
  process.exit(1);
}
