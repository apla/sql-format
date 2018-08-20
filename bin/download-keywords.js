import fetch from 'node-fetch';
import {DOMParser} from 'xmldom';
import NWMatcher from 'nwmatcher/src/nwmatcher-noqsa';

import crypto from 'crypto';

import {promisify} from 'util';

import path from 'path';

import fs from 'fs';
// const {readFile, writeFile} = fs.promises; // only in 10.x
const
    readFile  = promisify (fs.readFile),
    writeFile = promisify (fs.writeFile);

function downloadKeywords (vendors) {
    Object.keys (vendors).filter (
        vendor => !vendors[vendor].skip
    ).forEach (vendor => {
        const commandsConf = vendors[vendor].commands;
        const keywordsConf = vendors[vendor].keywords;
        Promise.all ([
            fetchingDocs (commandsConf).then (docs => docs.map (doc => findKeywords (commandsConf, doc))),
            fetchingDocs (keywordsConf).then (docs => docs.map (doc => findKeywords (keywordsConf, doc)))
        ]).then (([commands, keywords]) => {
            console.log (
                commands.reduce ((values, val) => values.concat (val), []),
                keywords.reduce ((values, val) => values.concat (val), [])
            );
        })
        
    });
}

const vendors = {
    // https://www.ibm.com/support/knowledgecenter/SSEPEK_11.0.0/sqlref/src/tpc/db2z_structuredquerylanguage.html
    db2: {
        skip: true,
        commands: {
            urls: 'https://www.ibm.com/support/knowledgecenter/en/SSEPEK_11.0.0/sqlref/src/tpc/db2z_sqlstatementslist.html?view=embed',
            selector: '#db2z_sqlstatementslist__summsl a',
            match: /^(.*?)\s*(?:\(|$)/
        },
        keywords: {
            urls: 'https://www.ibm.com/support/knowledgecenter/en/SSEPEK_11.0.0/sqlref/src/tpc/db2z_reservedwords.html?view=embed',
            selector: '.sli'
        },
        functions: {
            urls: 'https://www.ibm.com/support/knowledgecenter/en/SSEPEK_11.0.0/sqlref/src/tpc/db2z_sqlfunctionslist.html?view=embed',
            selector: '#db2z_ssqlfunctionslist__sumfun a'
        },
        /*
        types: {
            // https://www.ibm.com/support/knowledgecenter/SSEPEK_11.0.0/sqlref/src/tpc/db2z_datatypesintro.html
        }
        */
        
    },
    // https://github.com/couchbase/docs-cb4/blob/vulcan/content/n1ql/n1ql-language-reference/n1ql-langref.ditamap
    // Statements menu on sidebar: https://developer.couchbase.com/documentation/server/5.5/n1ql/n1ql-language-reference/index.html
    n1ql: {
        skip: true
    },
    // https://docs.oracle.com/database/121/SQLRF/ap_keywd001.htm#SQLRF55621
    oracle: {
        skip: true,
        commands: {
            urls: [
                'https://docs.oracle.com/database/121/SQLRF/statements_1.htm#SQLRF008',
                'https://docs.oracle.com/database/121/SQLRF/statements_2.htm#SQLRF009',
                'https://docs.oracle.com/database/121/SQLRF/statements_3.htm#SQLRF010',
                'https://docs.oracle.com/database/121/SQLRF/statements_4.htm#SQLRF011',
                'https://docs.oracle.com/database/121/SQLRF/statements_5.htm#SQLRF012',
                'https://docs.oracle.com/database/121/SQLRF/statements_6.htm#SQLRF013',
                'https://docs.oracle.com/database/121/SQLRF/statements_7.htm#SQLRF014',
                'https://docs.oracle.com/database/121/SQLRF/statements_8.htm#SQLRF015',
                'https://docs.oracle.com/database/121/SQLRF/statements_9.htm#SQLRF016',
                'https://docs.oracle.com/database/121/SQLRF/statements_10.htm#SQLRF017'
            ],
            selector: 'ul li a',
            match: /^(.*?)\s*(?:\(|$)/
        },
        keywords: {
            urls: 'https://docs.oracle.com/database/121/SQLRF/ap_keywd001.htm#SQLRF55621',
            selector: '.sect1>code',
            match: /^(.*?)\s*(?:\*|$)/
            // * is also ansi reserved
        }
        /*
        types: {
            // https://docs.oracle.com/database/121/SQLRF/sql_elements001.htm#SQLRF30020
        }
        */
    },
    // mssql 2000 http://msdn2.microsoft.com/en-us/library/aa238507
    // https://docs.microsoft.com/en-us/sql/t-sql/language-elements/reserved-keywords-transact-sql?view=sql-server-2017
    mssql: {
        skip: true,
        commands: {
            urls: 'https://github.com/MicrosoftDocs/sql-docs/blob/live/docs/t-sql/statements/toc.yml',
            parser: 'yaml',

        },
        keywords: {
            // https://github.com/MicrosoftDocs/sql-docs/blob/live/docs/t-sql/language-elements/reserved-keywords-transact-sql.md
            // https://docs.microsoft.com/en-us/sql/t-sql/language-elements/reserved-keywords-transact-sql?view=sql-server-2017
        }
    },
    // https://dev.mysql.com/doc/refman/5.7/en/keywords.html
    mysql: {
        skip: true,
        commands: {
            urls: [
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-data-definition.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-data-manipulation.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-transactions.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-replication.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-prepared-statements.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-compound-statements.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-server-administration.html',
                'https://dev.mysql.com/doc/refman/5.7/en/sql-syntax-utility.html',

                'https://dev.mysql.com/doc/refman/5.7/en/replication-master-sql.html',
                'https://dev.mysql.com/doc/refman/5.7/en/replication-slave-sql.html',
                'https://dev.mysql.com/doc/refman/5.7/en/replication-group-sql.html'
            ],
            selector: '#docs-main dt span.section a',
            match: /^[\d\.]+\s+(.*)\s+Syntax/
        },
        keywords: {
            urls: 'https://dev.mysql.com/doc/refman/5.7/en/keywords.html',
            selector: '#docs-body li.listitem code.literal'
        }
    },
    // https://www.postgresql.org/docs/10/static/sql-keywords-appendix.html
    pgsql: {
        skip: true,
        commands: {
            urls: 'https://www.postgresql.org/docs/10/static/sql-commands.html',
            selector: '#SQL-COMMANDS .refentrytitle a',
            replace: [/\n/g, ' ']
        },
        keywords: {
            urls: 'https://www.postgresql.org/docs/10/static/sql-keywords-appendix.html',
            selector: '#KEYWORDS-TABLE code.token'
        },
        // https://www.postgresql.org/docs/10/static/datatype.html
    },
    // https://www.postgresql.org/docs/10/static/sql-keywords-appendix.html
    standard: {
        // skip: true,
        commands: {
            urls: 'https://raw.githubusercontent.com/apla/sql-overview/master/sql-2011-foundation-grammar.txt',
            parser: 'grammar',
            selector: 'SQL executable statement', // 
            afterFirstLiteral: true,
            splitLiterals: true
        },
        keywords: {
            urls: 'https://raw.githubusercontent.com/apla/sql-overview/master/sql-2011-foundation-grammar.txt',
            parser: 'grammar',
            selector: ['reserved word', 'non-reserved word'],
            afterFirstLiteral: false,
            splitLiterals: true
        },
    }


};

downloadKeywords (vendors);

function fetchingDocs ({urls, selector}) {
    urls = [].concat (urls);
    return Promise.all (urls.map (url => {
        const cacheFilename = path.join (
            process.cwd(), 
            'tmp', 
            crypto.createHash ('md5').update (url).digest ("hex")
        );

        return readFile (cacheFilename).then (
            contents => contents,
            async err => {
                const res = await fetch (url);
                const resText = await res.text();
                await writeFile (cacheFilename, resText);
                return resText;
            }
        );
    }));
    // )

}

function findKeywords (conf, body) {
    if (!conf.parser)
        return findKeywordsInHTML (conf,body);
    
    switch (conf.parser) {
        // case 'yaml':
            
        //    break;
    
        case 'grammar':
            return findKeywordsInGrammar (conf, body);

        default:
            break;
    }
}

function findKeywordsInHTML (conf, body) {
    // console.log(arguments);
    const doc = parseResponse (body.toString ('utf8'));

    const kwNodes = Array.from (doc.documentElement.querySelectorAll (conf.selector));
    const keywords = kwNodes.map (node => Array.from (node.childNodes).filter (
        // select only those nodes which are direct children and non-empty
        cNode => cNode.nodeName === '#text' && cNode.textContent.trim() !== ''
    )[0]).filter (
        // skip non-existing
        node => node
    ).map (node => {
        
        let result = node.textContent;
        
        // match regexp if any
        if (conf.match) {
            if (!result.match (conf.match))
                return console.log (`Match error: ${result} !~ ${conf.match}`);
            result = result.match (conf.match)[1];
        }
        
        // check if UPPERCASE
        if (result.toUpperCase() !== result) {
            return console.log (`Upper case error: ${result}`);
        }

        // sometimes additional cleanup needed
        if (conf.replace) {
            result = result.replace (conf.replace[0], conf.replace[1]);
        }

        return result;
    }).filter (
        // only UPPERCASE
        keyword => keyword
    );

    return keywords;
}

function expandGrammarDef (def, defs, {afterFirstLiteral = false, splitLiterals = true}) {
    const refRE = /<([^<>]+)>/g;
    const refStartRE = /^\s*<([^>]+)>/;

    if (!def.match (refStartRE) && afterFirstLiteral) {
        return [def.trim().replace (/[\n\s]+/g, ' ')];
    }

    const result = [];

    def.trim ().split (/[\s\n]*\|[\s\n]*/).forEach (alt => {
        
        let refs = alt.match (refRE);
    
        if (afterFirstLiteral) {

            if (!alt.match (refStartRE)) {
                result.push (alt.replace (/\s+/, ''));
                return 
            }

            let ref0 = refs[0].slice(1, -1).trim().replace(/\s+/, ' ');

            // console.log ('going deeper, "%s" > "%s"', alt, ref0);

            // issue with doc
            if (
                // ref0 === 'set session collation statement' ||
                ref0.match(/implementation\-defined/)
            )
                return;

            // ref0 = {'update statement: positioned': 'updatestatement: positioned'}[ref0] || ref0;

            if (!defs[ref0]) {
                console.error (`"${ref0}" not defined`);
            }

            const deeper = expandGrammarDef (
                // seems like we have issues with whitespace in original doc
                defs[ref0],
                defs,
                {afterFirstLiteral, splitLiterals}
            );

            // console.log (deeper);

            deeper.forEach (val => result.push(val));

        } else { // !afterFirstLiteral
            if (refs) {
                // TODO
                console.warn ('Literal expansion not supported');
            } else {
                result.push (alt);
            }
        }
    })

    return result;

}

function findKeywordsInGrammar (conf, body) {
    
    const defRE = /^<([^>]+)>\s+\:\:=\s*$/m;
    const defComplRE = /^<([^>]+)>\s+\:\:=\s*$([\s\S]*)/m;

    const defs = body.toString ('utf8').split (/\r?\n(?:\r?\n)+(?!\s)/).filter (
        line => line.match (defRE)
    ).reduce ((defs, val) => {
        const [, name, body] = val.match (defComplRE);
        // seems like we have issues with whitespace in original doc
        defs[name.trim().replace(/\s+/, ' ')] = body;
        return defs;
    }, {});

    return [].concat (conf.selector).map (selector => {
        return expandGrammarDef (defs[selector], defs, conf);
    })


    /*
    const kwNodes = Array.from (doc.documentElement.querySelectorAll (conf.selector));
    const keywords = kwNodes.map (node => Array.from (node.childNodes).filter (
        // select only those nodes which are direct children and non-empty
        cNode => cNode.nodeName === '#text' && cNode.textContent.trim() !== ''
    )[0]).filter (
        // skip non-existing
        node => node
    ).map (node => {
        
        let result = node.textContent;
        
        // match regexp if any
        if (conf.match) {
            if (!result.match (conf.match))
                return console.log (`Match error: ${result} !~ ${conf.match}`);
            result = result.match (conf.match)[1];
        }
        
        // check if UPPERCASE
        if (result.toUpperCase() !== result) {
            return console.log (`Upper case error: ${result}`);
        }

        // sometimes additional cleanup needed
        if (conf.replace) {
            result = result.replace (conf.replace[0], conf.replace[1]);
        }

        return result;
    }).filter (
        // only UPPERCASE
        keyword => keyword
    );
    */

    // return keywords;
}


function parseResponse (body) {
        
    var document = new DOMParser().parseFromString(body, 'text/html');

    const
        Document = document.constructor,
        Element = document.documentElement.constructor,
        matcher = NWMatcher ({document});
    
    [Document, /*DocumentFragment, */Element].forEach(function (Class) {
        Class.prototype.querySelector = function (selectors) {
            return matcher.first(String(selectors), this);
        };

        Class.prototype.querySelectorAll = function (selectors) {
            return matcher.select(String(selectors), this);
        };
    });

    Element.prototype.matches = function (selectors) {
        return matcher.match(this, selectors);
    };

    return document;
}