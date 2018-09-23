// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond Cloud
//
// Copyright 2018 Google LLC
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('thingengine-core/lib/polyfill');
process.on('unhandledRejection', (up) => { throw up; });

const assert = require('assert');
const path = require('path');

const db = require('../util/db');
const userModel = require('../model/user');
const organization = require('../model/organization');
const user = require('../util/user');
const Importer = require('../util/import_device');
const makeRandom = require('../util/random');

const platform = require('../util/platform');

const Config = require('../config');
assert.strictEqual(Config.WITH_THINGPEDIA, 'embedded');

const req = { _(x) { return x; } };

async function loadAllDevices(dbClient, bob, root) {
    // "login" as bob
    req.user = bob;

    const invisible = require('./data/org.thingpedia.builtin.test.invisible.manifest.json');
    await Importer.importDevice(dbClient, req, 'org.thingpedia.builtin.test.invisible', invisible, {
        owner: req.user.developer_org,
        approve: false
    });

    const bing = require('./data/com.bing.manifest.json');
    await Importer.importDevice(dbClient, req, 'com.bing', bing, {
        owner: req.user.developer_org,
        zipFilePath: path.resolve(path.dirname(module.filename), './data/com.bing.zip'),
        approve: true
    });

    // now "login" as root
    req.user = root;

    const adminonly = require('./data/org.thingpedia.builtin.test.adminonly.manifest.json');
    await Importer.importDevice(dbClient, req, 'org.thingpedia.builtin.test.adminonly', adminonly, {
        owner: req.user.developer_org,
        approve: false
    });
}

async function main() {
    platform.init();

    await db.withTransaction(async (dbClient) => {
        const newOrg = await organization.create(dbClient, {
            name: 'Test Org',
            comment:  '',
            developer_key: makeRandom(),
            is_admin: false
        });

        const bob = await user.register(dbClient, req, {
            username: 'bob',
            password: '12345678',
            email: 'bob@localhost',
            locale: 'en-US',
            timezone: 'America/Los_Angeles',
            developer_org: newOrg.id,

            // must be a TRUSTED_DEVELOPER to self-approve the new device
            // w/o hacks
            developer_status: user.DeveloperStatus.TRUSTED_DEVELOPER,
        });

        const [root] = await userModel.getByName(dbClient, 'root');
        await loadAllDevices(dbClient, bob, root);

        console.log(`export DEVELOPER_KEY="${newOrg.developer_key}"`);
    });

    await db.tearDown();
}
main();
