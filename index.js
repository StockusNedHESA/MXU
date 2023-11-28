/**
 * Goal is to ensure that is ran from a single file
 */

const { readFile, writeFile, readdir, rm, mkdir } = require('fs/promises');
const { readFileSync } = require('fs')
const { resolve } = require('path');
const { XMLBuilder, XMLParser } = require('fast-xml-parser');
const { terminal } = require('terminal-kit');
const JSON5 = require('json5')
const Config = JSON5.parse(readFileSync('./config.jsonc'))

//#region CONSTANTS
const INPUT_DIR = 'input';
const OUTPUT_DIR = 'output';
const DELETE_OUTPUT = true;
const Parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
const Builder = new XMLBuilder({ format: true, ignoreAttributes: false })
//#endregion

const procedures = {
    /**
     * Removes corresponding fields from the XML object
     * @param {Object.<string, any>} XML 
     * @param {Object.<string, any>} procedure 
     */
    async removeFields(XML, procedure) {
        for (const item of procedure.items) {
            let current = XML
            const keys = item.split('.').filter(item => item)

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i]

                if (current.hasOwnProperty(key)) current = current[key]
                else terminal(`Item key "${key}" does not exist`)
            }

            const lastKey = keys[keys.length - 1]
            if (current.hasOwnProperty(lastKey)) delete current[lastKey]
        }
    },
    /**
     * Add's fields speicifed into the object at set location
     * @param {Object.<string, any>} XML 
     * @param {Object.<string, any>} procedure 
     */
    async addFeilds(XML, procedure) {
        for (const item of procedure.items) {
            let toUpdate = XML
            const keys = item.base.split('.').filter(item => item)

            for (const key of keys) {
                if (toUpdate.hasOwnProperty(key)) toUpdate = toUpdate[key]
                else terminal(`Base key "${key}" does not exist`)
            }

            const locationKey = Object.keys(toUpdate).indexOf(item.location)
            if (locationKey === -1) {
                terminal(`Location field "${item.location}" does not exist`)
                continue;
            }

            toUpdate = addToObject(
                toUpdate,
                item.field,
                item.value,
                locationKey + (item.where == 'below' ? 1 : -1)
            )

            set(XML, item.base, toUpdate)
        }
    }
};

// Async execution of main code
((async () => {
    terminal.eraseDisplay(); // Display MXU Logo
    terminal(`\t███╗░░░███╗██╗░░██╗██╗░░░██╗\n\t████╗░████║╚██╗██╔╝██║░░░██║\n\t██╔████╔██║░╚███╔╝░██║░░░██║\n\t██║╚██╔╝██║░██╔██╗░██║░░░██║\n\t██║░╚═╝░██║██╔╝╚██╗╚██████╔╝\n\t╚═╝░░░░░╚═╝╚═╝░░╚═╝░╚═════╝░\n`)
    terminal("―".repeat(45) + '\n')

    terminal.table([
        ['Procedure', 'Enabled'],
        ...Config.map(item => [item.friendlyName, item.enabled ? "Yes" : "No"])
    ], {
        hasBorder: true,
        contentHasMarkup: true,
        borderChars: 'lightRounded',
        textAttr: { bgColor: 'default' },
        width: 40,
        fit: true
    })

    terminal("―".repeat(45) + '\n')

    const files = await readdir(INPUT_DIR)

    terminal(`Located `).bold(files.length).defaultColor(` files inside ${INPUT_DIR} directory\n`)
    terminal("Delete output ").bold(DELETE_OUTPUT ? 'enabled' : 'disabled').defaultColor(' before start\n\n')

    if (DELETE_OUTPUT) {
        await rm(OUTPUT_DIR, { recursive: true, force: true })
        await mkdir(OUTPUT_DIR)
    }

    const progressBar = terminal.progressBar({ title: "test", titleSize: 40, width: 100, percent: true, eta: true, syncMode: true })
    let progress = 0
    for (const file of files) {
        const text = await readFile(resolve(`${__dirname}/${INPUT_DIR}/${file}`), 'utf-8')
        const XML = Parser.parse(text)

        for (const procedure of Config.filter(item => item.enabled)) await procedures[procedure.identifier](XML, procedure)

        progress++
        progressBar.update({
            progress: (progress / files.length),
            title: file
        })

        await writeFile(
            resolve(`${__dirname}/${OUTPUT_DIR}/${file}`),
            Builder.build(XML)
        )
    }

    progressBar.stop()

    terminal.eraseLine()
    terminal.eraseArea(terminal.width,terminal.height-2)
    terminal("―".repeat(45) + '\n')
    terminal.green("Processed complete\n")
    terminal(`Finished processing ${files.length} XMLs`)

})());

/**
 * Logic for adding key/value to set location of object
 * @param {Object.<string, any>} obj 
 * @param {string} key 
 * @param {any} value 
 * @param {number} index 
 * @returns {Object.<string, any>}
 */
function addToObject(obj, key, value, index) {
    const temp = {};
    let i = 0;

    for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            if (i === index && key) temp[key] = value;
            temp[prop] = obj[prop];
            i++;
        }
    }

    if (!index && key) temp[key] = value;

    return temp;
}

/**
 * Updates a traversal path of object
 * @param {Object.<string, any>} object 
 * @param {string} key 
 * @param {any} value 
 * @param {Array.<string>} properties 
 * @param {number} i 
 */
function set(object, key, value, properties = key.split('.'), i = 0) {
    if (i === properties.length - 1) object[properties[i]] = value;
    else set(object[properties[i]], '', value, properties, i + 1);
}