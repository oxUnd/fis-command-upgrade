/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

var pth = require('path'),
    util = require('./util.js');

exports.update = function(content, namespace, ld, rd, filepath, root, widgetInline) {
    content = replaceWidget(content, namespace, ld, rd, widgetInline);
    content = replaceExtends(content, ld, rd, filepath, root, namespace)
    content = replaceInclude(content, namespace, ld, rd, filepath, root)
   // content = replaceHTML(content, ld, rd);
    content = replaceScript(content, ld, rd);
    return content;
}
/**
 * {widget name="menu" $a='a'} => {widget name="module:widget/menu/menu.tpl" $a='a'}
 * {widget name="common:menu"} => {widget name="common:widget/menu/menu.tpl"}
 * {widget name="menu"} => <!--inline[/widget/menu/menu.tpl]-->
 * {widget name="menu" $a='a' inline="false"} => {widget name="module:widget/menu/menu.tpl" $a='a'}
 * {widget name="menu" inline="true"} => <!--inline[/widget/menu/menu.tpl]-->
 * */
function replaceWidget(content, namespace, ld, rd, widgetInline){
    var tmpwidgetInline = widgetInline;
    var l_ld = pregQuote(ld);
    var l_rd = pregQuote(rd);
    var reg = new RegExp('(?:'+l_ld+'\\s*\\bwidget\\b([\\s\\S]*?)'+l_rd+'|'+l_ld+'\\s*\\/widget\\s*'+l_rd+')', 'g');
    content = content.replace(reg, function(m, value) {

        widgetInline = tmpwidgetInline;
        var path = '';
        var nameReg = /\bname\s*=\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+')\s*/;
        var pathReg = /\bpath\s*=\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+')\s*/;
        var inlineReg = /\binline\s*=\s*[\\'"]\s*(false|true)\s*[\\'"]/;
        if (value) {

            if (!nameReg.test(value)) {
                if(pathReg.test(value)){
                    widgetInline = false;
                    value = value.replace(pathReg, function (m1, v) {
                        var info = fis.util.stringQuote(v);
                        v = info.rest.trim();
                        if (v && v.indexOf(':') === -1) {
                            v = namespace+':'+v;
                            m1 = 'name=' + info.quote + util.removeModuleName(v, namespace) + info.quote + ' ';
                        }
                        return m1;
                    });
                    m = ld + 'widget '  + util.trim(value) + rd;
                }else{
                    m = '';
                }
            } else {
                value = value.replace(nameReg, function (m1, v) {
                    var info = fis.util.stringQuote(v);
                    v = info.rest.trim();
                    if (v && v.indexOf(':') === -1 && v.indexOf('.tpl') === -1) {
                        v = getWidgetPath(namespace, v);
                        path = v ;
                        v = namespace+':'+v;
                        m1 = 'name=' + info.quote + util.removeModuleName(v, namespace) + info.quote + ' ';
                    }else{
                        var group = v.split(':');
                        if(group[0] != namespace){
                            widgetInline = false;
                        }
                        if(group[1].indexOf('.tpl') == -1){
                            v = getWidgetPath(group[0], group[1]);
                            path = v;
                            m1 = 'name=' + info.quote + group[0] + ':' + util.removeModuleName(v, namespace) + info.quote + ' ';
                        }
                    }
                    return m1;
                });
                m = ld + 'widget '  + util.trim(value) + rd;
            }
        } else {
            m = '';
        }
        if(inlineReg.test(m)){
            m = m.replace(inlineReg,function(m1, v1){
                if(v1 == 'false'){
                    widgetInline = false;
                    return '';
                }else{
                    widgetInline = true;
                    return '';
                }
            });
        }
        if(!widgetInline || m == ''){
            return m;
        }
        // path = getWidgetPath(namespace, path);
        return '<!--inline[/' + path + ']-->';
    });
    return content;
}

function getWidgetPath(namespace, path){
    var basename = path;
    if(path.indexOf('/')){
        var group = path.split('/');
        basename = group[group.length-1];
    }
    return 'widget/' + path + '/' + basename + '.tpl';
}

/**
 * {extends file="page/common/layout.tpl"} => {extends file="common/page/layout.tpl"}
 * */
function replaceExtends(content, ld, rd, filepath, root, namespace){
    var l_ld = pregQuote(ld);
    var l_rd = pregQuote(rd);
    var rd_0 = pregQuote(rd.substr(0, 1), '/');
    //右边界剩下字符的正则转义
    var rd_1 = pregQuote(rd.substr(1), '/');
    var reg = new RegExp(l_ld + 'extends\\s+((?:[^' + l_rd + ']|' + rd_0 + '(?!' + rd_1 + '))*?)' + l_rd, 'g');
    var regfile = /\bfile\s*=\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+')\s*/;
    content = content.replace(reg, function(m, value) {
        var v1 = value.replace(regfile, function (m1, v) {
            if(v.indexOf(':') !== -1){
                return util.removeModuleName(m1, namespace);
            }
            v = v.substring(1, v.length-1);
            if(v.substr(0, 1) == '.'){
                v = pth.normalize(pth.dirname(filepath) + '/' + v);
                v = v.replace(/[\/\\]+/g, '/');
                v = v.replace(root + '/', '');
            }
            var group = v.split('/');
            if(group[1] == 'common'){
                return 'file=\'common/' + util.removeModuleName(v, namespace) + '\'';
            }
            return 'file=\'' + namespace + '/'+ util.removeModuleName(v, namespace) + '\'';
        });
        return m.replace(value, v1);
    });
    return content;
}

/**
 * {include file="page/home/a.tpl"} => {include file="home/page/a.tpl"}
 * {include file="./a.tpl"} => {include file="home/page/a.tpl"}
 * {include file="./a.tpl" inline="true"} =>  <!--inline[/page/a.tpl]-->
 * */
function replaceInclude(content, namespace, ld, rd, filepath, root){
    var l_ld = pregQuote(ld);
    var l_rd = pregQuote(rd);
    var rd_0 = pregQuote(rd.substr(0, 1), '/');
    //右边界剩下字符的正则转义
    var rd_1 = pregQuote(rd.substr(1), '/');
    var reg = new RegExp(l_ld + 'include\\s+((?:[^' + l_rd + ']|' + rd_0 + '(?!' + rd_1 + '))*?)' + l_rd, 'g');
    var regfile = /\bfile\s*=\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+')\s*/;
    var reginline = /\binline\s*=\s*("(?:[^\\"]|\\[\s\S])+"|'(?:[^\\']|\\[\s\S])+'|\b)\s*/;
    content = content.replace(reg, function(m, value) {
        //先判断是否有inline
        var inline = false;
        var path = '';
        var v1 = value.replace(reginline, function(m1, v){
            v = v.substring(1, v.length-1);
            inline = (v == 'true' || v == '1' || m1 == 'inline');
        });
        v1 = value.replace(regfile, function (m1, v) {
//            if(v.indexOf(':') != -1){
//                return util.removeModuleName(m1, namespace);
//            }
            v = v.substring(1, v.length-1);
            if(v.substr(0, 1) == '.'){
                v = pth.normalize(pth.dirname(filepath) + '/' + v);
                v = v.replace(/[\/\\]+/g, '/');
                v = v.replace(root + '/', '');
            }
            v = util.removeModuleName(v, namespace);
            if(!inline){
                var group = v.split('/');
                if(group[1] == 'common'){
                    return 'file=\'common/' + v + '\'';
                }
                return 'file=\'' + namespace + '/' + v + '\'';
            }
            path = v;
        });
        if(!inline){
            return m.replace(value, v1);
        }
        return '<!--inline[/'+ path + ']-->';
    });
    return content;
}

/**
 * <html> ---> {html}
 *
 * @param content
 * @param ld
 * @param rd
 * @returns {XML}
 */
function replaceHTML(content, ld, rd){
    var reg = /<html(?:(\s+[\s\S]+?["'\s\w\/])>|\s*)>|(\<\/html\>)|<body(?:(\s+[\s\S]+?["'\s\w\/])>|\s*>)|(\<\/body>)|<head(?:(\s+[\s\S]+?["'\s\w\/])>|\s*>)|(\<\/head\>)/g;
    content = content.replace(reg, function(m, v1, v2, v3, v4, v5, v6){
        if(v1){
            m = ld + 'html' + v1 + rd;
        }else if(m.substring(0,5) === '<html'){
            m = ld + 'html' + rd;
        }else if(v2){
            m = ld + '/html' + rd;
        }else if(v3){
            m = ld + 'body' + v3 + rd;
        }else if(m.substring(0,5) === '<body'){
            m = ld + 'body' + rd;
        }else if(v4){
            m = ld + '/body' + rd;
        }else if(v5){
            m = ld + 'head' + v5 + rd;
        }else if(m.substring(0,5) === '<head'){
            m = ld + 'head' + rd;
        }else if(v6){
            m = ld + '/head' + rd;
        }
        return m;
    });
    return content;
}

function replaceScript(content, ld, rd){
    var reg = /(\<script\b[^>]*\>)([\s\S]*?)(\<\/script\s*\>)/g;
    var srcreg = /^(\<script\b[^>]*?src\s*=\s*)("[^"]+"|[^\s>]+)([^>]*\>)$/i;
    var requirereg = /\brequire.async/;
    content = content.replace(reg, function(m, v1, v2, v3){
        if(srcreg.test(v1)){
            return m;
        }
        if(requirereg.test(v2)){
            return ld + 'script' +rd + v2 + ld + '/script' +rd;
        }
        return m;
    });
    return content;
}

function pregQuote (str, delimiter) {
    // http://kevin.vanzonneveld.net
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
}
