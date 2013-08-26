/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

var util = require('./util.js'),
    pth = require('path');

exports.update = function(content, namespace, filepath, root) {
    var libs = [
        'tangram',
        'fis',
        'magic',
        'gmu',
    ];
    var filepath = filepath,
        root = root;

    function inArray (needle, haystack, argStrict) {
        var key = '',
            strict = !! argStrict;
        if (strict) {
            for (key in haystack) {
                if (haystack[key] === needle) {
                    return true;
                }
            }
        } else {
            for (key in haystack) {
                if (haystack[key] == needle) {
                    return true;
                }
            }
        }
        return false;
    }

    function getPathId(v, namespace) {
        var group = '';
        //没有：
        if(v.indexOf(':') == -1) {
            if(v.indexOf('.js') == -1){
                group = v.split('/');
                v = namespace + ':widget/' + namespace + '/ui/' + v + '/' + group[group.length-1] + '.js';
            }else if(v.indexOf('.') == 0){
                v = pth.normalize(pth.dirname(filepath) + '/' + v);
                v = v.replace(/[\/\\]+/g, '/');
                v = v.replace(root + '/', '');
                v = namespace + ':' + v;
            }else if(v.indexOf('.js') != -1 && v.indexOf('static') == 0){
                v = namespace + ':' + v;
            }else if(v.indexOf('.js') != -1 && v.indexOf('/static') == 0){
                v = namespace + ':' + v.substring(1);
            }
        }else if( v.indexOf(':') !== -1){
            group = v.split(':');
            if (group[1].indexOf('.js') == -1) {
                var tpmnamespace = util.trim(group[0]);
                if(tpmnamespace == namespace || tpmnamespace == 'common'){
                    var grouptmp = group[1].split('/');
                    v = tpmnamespace + ":widget/" + tpmnamespace + '/ui/' +  group[1] + '/' + grouptmp[grouptmp.length-1] + '.js';
                }else if (inArray(tpmnamespace, libs)) {
                    if(group[1] == '' && tpmnamespace == 'magic'){
                        v = 'common:widget/lib/magic/magic.js';
                    }else{
                        var grouptmp = group[1].split('/');
                        v = 'common:widget/lib/' + tpmnamespace + '/' + group[1] + '/' + grouptmp[grouptmp.length-1] + '.js';
                    }
                }
            };
        }
        v = util.getStandardPath(v, namespace);
        return v;
    }

    function parseExports(content){
        var reg = /(\bexports\b\s*=|\bmodule.exports\b\s*=)/g
        content = content.replace(reg, function(m, v){
            if(v && v.indexOf('e') == 0 ){
                return 'module.exports =';
            }
            return m;
        });
        return content;
    }

    //对require添加namespace,注意私有处理
    function parseRequire(content, namespace) {
        var reg = /\brequire\s*\(\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+')\s*\)/g;
        content = content.replace(reg, function(m, value){
            if(value){
                var info = fis.util.stringQuote(value);
                value = info.rest.trim();
                value = getPathId(value, namespace);
                m = 'require(' + info.quote + value + info.quote + ')';
            }
            return m;
        });
        return content;
    }

    /**
     * F.use -> require
     **/
    function parseUse(content, namespace) {
        var reg = /(?:\/\*[^*]*\*+(?:[^\/*][^*]*\*+)*\/)|(?:\/\/[^\n\r\f]*)|F.use\s*\(\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+'|(?:\[[^\[\]]+?\]))\s*/g;
        return content.replace(reg, function (m , value) {
            if (value) {
                var hasBrackets = false;
                var values = [];
                value = value.trim().replace(/(^\[|\]$)/g, function(m, v) {
                    if (v) {
                        hasBrackets = true;
                    }
                    return '';
                });
                values = value.split(/\s*,\s*/);
                values = values.map(function(v) {
                    var info = fis.util.stringQuote(v);
                    v = info.rest.trim();
                    v = getPathId(v, namespace);
                    return info.quote + v + info.quote;
                });
                if (hasBrackets) {
                    m = 'require.async([' + values.join(', ') + ']';
                } else {
                    m = 'require.async(' + values.join(', ');
                }
            }
            return m;
        });
        return content;
    }

    function parseTemplate(content){
        var reg = /\bF.template/g;
        content = content.replace(reg, function (m , value) {
            return '__inline'
        });
        return content;
    }

    function parseUri(content) {
        var reg = /\bF.uri/g;
        content = content.replace(reg, function(m, value){
            return '__uri';
        });
        return content;
    }

    function parseFcontent(content){
        var reg = /(\bF\.context)(?:\([^)]*\))/g;
        content = content.replace(reg, function (m , value) {
            if(m.indexOf(',') !== -1){
                m = m.replace('F.context', 'define');
            }else{
                m = m.replace('F.context', 'require');
            }
            return m;
        });
        return content;
    }

    content = parseRequire(content, namespace);
    content = parseUse(content, namespace);
    content = parseUri(content);
    content = parseTemplate(content);
    content = parseExports(content);
    return content;
}

