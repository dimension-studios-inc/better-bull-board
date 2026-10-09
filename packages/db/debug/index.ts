import { logger } from "@rharkor/logger"

const main = async () => {
  await logger.init()
}

void main().then(() => process.exit(0))
