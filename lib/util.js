/*
 * fis
 * http://web.baidu.com/
 */

'use strict';

var util = module.exports = {};

util.detContext = function(content){
    var reg = /(\bF\.context)(?:\([^)]*\))/g;
    if(reg.test(content)){
        return true;
    }
    return false;
}

util.detMarco = function(content){
    var reg = /\{[^}]+{/;
    if(reg.test(content)){
        return true;
    }
    if(/@mixin/.test(content)){
        return true;
    }
    if(/@var/.test(content)){
        return true;
    }
    if(/@fis/.test(content)){
        return true;
    }
    return false;
}

util.detWidgetExtends = function(content, ld, rd){
    var reg = new RegExp(ld + 'widget(?:\\s+|' + rd + ')(?:[\\s\\S]*?)' + ld + '\/widget\\s*' + rd);
    if(reg.test(content)){
        reg = /\bextends\s*=\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+')\s*/;
        if(reg.test(content)){
            return true;
        }
    }
    reg = new RegExp(ld + 'widget_block');
    if(reg.test(content)){
        return true;
    }
    return false;
}

util.trim = function(str, charlist) {
    var whitespace, l = 0,
        i = 0;
    str += '';

    if (!charlist) {
        // default list
        whitespace = " \n\r\t\f\x0b\xa0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000";
    } else {
        // preg_quote custom list
        charlist += '';
        whitespace = charlist.replace(/([\[\]\(\)\.\?\/\*\{\}\+\$\^\:])/g, '$1');
    }

    l = str.length;
    for (i = 0; i < l; i++) {
        if (whitespace.indexOf(str.charAt(i)) === -1) {
            str = str.substring(i);
            break;
        }
    }

    l = str.length;
    for (i = l - 1; i >= 0; i--) {
        if (whitespace.indexOf(str.charAt(i)) === -1) {
            str = str.substring(0, i + 1);
            break;
        }
    }

    return whitespace.indexOf(str.charAt(0)) === -1 ? str : '';
}


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

/**
 * 去掉模块名那一层 common:static/common/ui/a/a.js => common:static/ui/a/a.js
 * @param v
 * @param namespace
 * @returns {string}
 */
util.removeModuleName = function(v, namespace){
    if (typeof(v) === "undefined") return '';
    var pathSplit = [];
    if(v.indexOf(':') !== -1) {
        var group = v.split(':');
        var tpmnamespace = util.trim(group[0]);
        pathSplit = group[1].split('/');
        if(pathSplit[1] == tpmnamespace){
            pathSplit.splice(1, 1);
            v = tpmnamespace + ':' + pathSplit.join('/');
            return v;
        }
    }else{
        pathSplit = v.split('/');
        if(pathSplit[1] == namespace || pathSplit[1] == 'common'){
            pathSplit.splice(1, 1);
            v = pathSplit.join('/');
            return v;
        }
    }
    return v;
}

/**
 * 将common:static/ui/a/a.js 组件化放到widget下 common:widget/ui/a/a.js
 * common:static/lib/tangram/base.js => common:widget/lib/tangram/base.js
 * @param v
 * @param namespace
 */
function moveUiToWidget(v){
    if (typeof(v) === "undefined") return '';
    var tpmnamespace = '';
    var pathSplit = [];
    if(v.indexOf(':') !== -1){
        var group = v.split(':');
        tpmnamespace = util.trim(group[0]);
        pathSplit = group[1].split('/');
    }else{
        pathSplit = v.split('/');
    }
    if(pathSplit[0] == 'static' && inArray(pathSplit[1], ['ui', 'lib'])){
        pathSplit.splice(0, 1, 'widget');
        v = tpmnamespace ? tpmnamespace + ':' + pathSplit.join('/') : pathSplit.join('/');
    }
    return v;
}


util.getStandardPath = function(v, namespace, changePathJs){
    if (typeof(v) === "undefined") return '';
    if(v.substr(0,4) =='test'){
        v = v.substr(5);
    }
    v = util.removeModuleName(v, namespace);
    if(changePathJs){
        var pathChange = require(changePathJs);
        if(typeof pathChange.modifyPath === "function"){
            v = pathChange.modifyPath(v);
        }
    }else{
        v = moveUiToWidget(v);
    }

    return v;
}