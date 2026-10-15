#!/usr/bin/env node
import { runServer } from './server.ts';
runServer().catch(e=>{process.stderr.write(String(e.message||e)+'\n');process.exit(1)});
