/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

var fs = require('fs'),
    pth = require('path'),
    xmlreader = require('xmlreader'),
    js = require('./lib/jsUpgrade.js'),
    css = require('./lib/cssUpgrade.js'),
    tpl = require('./lib/tplUpgrade.js'),
    util = require('./lib/util.js'),
    _exists = fs.existsSync || pth.existsSync;

exports.name = 'upgrade';
exports.desc = 'Upgrade 1.0 - 2.0';
exports.register = function(commander) {
    var namespace, ld, rd,
        model = 0,
        widgetInline = false;

    commander
        .option('--namespace <namespace>', 'namespace', String, 'common')
        .option('--ld <smarty left delimiter>', 'smarty left delimiter', String, '{%')
        .option('--rd <smarty right delimiter>', 'smarty right delimiter', String, '%}')
        .action(function(options) {
            namespace = options.namespace;
            model = options.model;
            ld = options.ld;
            rd = options.rd;
            var root = fis.util.realpath(process.cwd());
            //判断是不是一个正规模块
            var xmlpath = root + '/config/fis-config.xml';
            var rootSplit = root.split('/');
            rootSplit.splice(rootSplit.length - 1, 1, rootSplit[rootSplit.length - 1] + '_2.0');
            var projectRoot = rootSplit.join('/');
            if(_exists(xmlpath)){
                xmlreader.read(fis.util.read(xmlpath), function(errors, res){
                    if(null !== errors ){
                        console.log(errors)
                        return;
                    }
                    if(res.project.attributes()['modulename']){
                        namespace = res.project.attributes().modulename;
                    }else{
                        console.log('There has no modulename!');
                        return;
                    }
                    if(res.project['smarty']){
                        if(res.project.smarty.attributes()['left_delimiter']){
                            ld = res.project.smarty.attributes().left_delimiter;
                        }
                        if(res.project.smarty.attributes()['right_delimiter']){
                            rd = res.project.smarty.attributes().right_delimiter;
                        }
                    }
                    if(res.project['setting']){
                        if(res.project['setting']['WidgetInlineSyntax']){
                            if(res.project['setting']['WidgetInlineSyntax'].attributes()['enable']){
                                var v = res.project['setting']['WidgetInlineSyntax'].attributes()['enable'];
                                widgetInline = (v == 'true' || v == '1');
                            }
                        }
                    }
                })
            }else{
                console.log('No configuration file, Please check the catalog is correct!');
                return;
            }
            console.log('Upgrade process starts.');
            var macro = new Array();
            var widget = new Array();
            var jsContext = new Array();
            fis.util.find(root).forEach(function(filepath) {
                //处理图片文件
                if(fis.util.isImageFile(filepath)) {
                    fis.util.copy(filepath, projectRoot + '/' + util.getStandardPath(filepath.replace(root + '/', ''), namespace));
                }
                if(/.*\.(tpl|js|html|css)$/.test(filepath)){
                    var content = fis.util.read(filepath);
                    content = js.update(content, namespace,filepath, root);
                    filepath = filepath.replace(/[\/\\]+/g, '/');
                    content = css.update(content, namespace, filepath, root);
                    if(/\.tpl$/.test(filepath)){
                        content = tpl.update(content, namespace, ld, rd, filepath, root, widgetInline);
                    }
                    filepath = projectRoot + '/' + util.getStandardPath(filepath.replace(root + '/', ''), namespace);
                    fis.util.write(filepath, content);

                    if(/\.tpl$/.test(filepath) && util.detWidgetExtends(content, ld, rd)){
                        widget.push(filepath);
                    }
                    if(/\.css$/.test(filepath) && util.detMarco(content)){
                        fs.renameSync(filepath, filepath.replace(/\.css/, '.less'));
                        macro.push(filepath);
                    }
                    if(util.detContext(content)){
                        jsContext.push(filepath);
                    }
                    console.log('Upgrade ' + filepath +' successfully!');
                }
            });
            if(fis.util.isDir(root + "/test")){
                fis.util.find(root + "/test").forEach(function(filepath) {
                    var content = fis.util.read(filepath);
                    filepath = filepath.replace(/[\/\\]+/g, '/');
                    filepath = projectRoot + '/test/' + util.getStandardPath(filepath.replace(root + '/test/', ''), namespace);
                    fis.util.write(filepath, content);
                });
            }
            if(fis.util.isDir(root + "/plugin")){
                fis.util.find(root + "/plugin").forEach(function(filepath) {
                    var content = fis.util.read(filepath);
                    filepath = filepath.replace(/[\/\\]+/g, '/');
                    filepath = filepath.replace(root, projectRoot);
                    fis.util.write(filepath, content);
                });
            }
            fis.util.find(root + "/config", /.*\.(conf)$/).forEach(function(filepath) {
                var content = fis.util.read(filepath);
                filepath = filepath.replace(/[\/\\]+/g, '/');
                filepath = projectRoot + '/' + util.getStandardPath(filepath.replace(root + '/', ''), namespace);
                fis.util.write(filepath, content);
            });
            var config = 'fis.config.merge({\n'
                + '      namespace : \'' + namespace +'\',\n'
                + '});';
            var configPath = projectRoot + '/fis-conf.js';
            fis.util.write(configPath, config);
            if(macro.length >0 || widget.length > 0 && jsContext.length > 0){
                fis.util.write(projectRoot + '/detect.html', createHTML(macro, widget,jsContext));
            }
            console.log('Upgrade process ends!');
        });
};

function createHTML(macro, widget, jsContext){
    var html = '<!DOCTYPE html>'
        + '<html>'
        + '  <head>'
        + '     <meta charset="utf-8">'
        + '     <title>FIS 2.0 detect</title>'
        + '     <link rel="stylesheet" href="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.2/css/bootstrap.min.css" type="text/css" />'
        + '     <style>'
        + '       .container{padding-top:10px;}'
        + '       .table th{background:whiteSmoke;}'
        + '       .table td{font-size:15px;}'
        + '     </style>'
        + '   </head>';
    var tr = '';

    if(jsContext.length > 0){
        for(var i = 0; i < jsContext.length; i++){
            tr += '<tr  class="info">';
            if(i == 0){
                tr += '<td style="text-align:center;margin-left:auto;vertical-align: middle;" rowspan="' + jsContext.length+ '">此文件中使用了F.context，2.0不支持此功能，请替换为其他数据中心.</td>'
            }
            tr += '  <td style="max-width:500px;word-break:break-all;"> ' + jsContext[i]+ '</td>'
                + '</tr>';
        }
    }

    if(macro.length > 0){
        for(var i = 0; i < macro.length; i++){
            tr += '<tr  class="error">';
            if(i == 0){
                tr += '<td style="text-align:center;margin-left:auto;vertical-align: middle;" rowspan="' + macro.length+ '">此文件中使用了Macro，请替换为Less语法,文件后缀已修改为less,同时请修改跨模块引用此文件的引用方式.</td>'
            }
            tr += '  <td style="max-width:500px;word-break:break-all;"> ' + macro[i]+ '</td>'
                + '</tr>';
        }
    }

    if(widget.length > 0){
        for(var i = 0; i < widget.length; i++){
            tr += '<tr  class="warning">';
            if(i == 0){
                tr += '<td style="text-align:center;margin-left:auto;vertical-align: middle;" rowspan="' + widget.length+ '">此文件中使用了widget继承，请替换此功能.</td>'
            }
            tr += '  <td style="max-width:500px;word-break:break-all;"> ' + widget[i]+ '</td>'
                + '</tr>';
        }
    }

    html += '<body>'
        +      '<div class="container">'
        +          '<table class="table table-bordered"><tbody>'
        +               '<tr class="table-header"><th style="text-align:center">检测功能</th><th style="text-align:center">文件路径</th></tr>'
        +                tr
        +          '</tbody></table>'
        +      '</div>'
        +  '</body>'
    return html;
}