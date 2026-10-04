import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_02_ADDITIONS, MINIGAME_02_CHANGED, MINIGAME_02_SOURCE_HASHES } from './scope-contract.mjs';
import { CONTRACT_V1_ADDITIONS, CONTRACT_V1_CHANGED, withoutContractDispatch } from '../minigame-contract-v1/scope-contract.mjs';
import { MINIGAME_03_ADDITIONS, MINIGAME_03_CHANGED } from '../minigame-03/scope-contract.mjs';
import { MINIGAME_04_ADDITIONS, MINIGAME_04_CHANGED } from '../minigame-04/scope-contract.mjs';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_CHANGED } from '../minigame-05/scope-contract.mjs';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_CHANGED } from '../minigame-06/scope-contract.mjs';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_CHANGED } from '../minigame-07/scope-contract.mjs';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_CHANGED } from '../minigame-platform-v1/scope-contract.mjs';

const BASE = 'f067a6ce8c611b0f68d8ba456a4fb511e5dfc9e2';
const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');




