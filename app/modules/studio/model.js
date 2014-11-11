﻿(function () {
  'use strict';

  var util = require('./helpers/util'),
    fs = require('fs'),
    proxy = require('./proxy'),
    ip = require('./node_modules/ip'),
    studio = adv.studio;

  studio.getItemByPath = function (localFile, proItems) {
    var data;
    proItems = proItems || studio.getProItems();
    for (var key in proItems) {
      if (proItems[key].localFile == localFile) {
        data = proItems[key];
      }
    }
    return data;
  };

  studio.getItemByUrl = function (url, proItems) {
    var data;
    proItems = proItems || studio.getProItems();
    for (var key in proItems) {
      if (proItems[key].url == url) {
        data = proItems[key];
      }
    }
    return data;
  };

  studio.getProItems = function () {
    var ss = adv.system.get();
    if (!ss.workspace) return;
    var proFilePath = ss.workspace + '\\zproject.json'
    if (!fs.existsSync(proFilePath)) {
      util.writeFileSync(proFilePath, JSON.stringify({}));
    }
    var pItems = util.readJsonSync(proFilePath);
    Object.keys(pItems).forEach(function (sKey) {
      var pro = pItems[sKey];
      Object.keys(pro).forEach(function (key) {
        if (~key.indexOf('$$')) {
          delete pro[key];
        }
      });
    });
    return pItems;
  };

  studio.general = function () {
    return {
      path: ''
    };
  };

  studio.saveProItem = function (proItem) {
    var ss = adv.system.get();
    if (!ss.workspace) return;
    var datas = studio.getProItems();
    var data = studio.getItemByUrl(proItem.url, datas);
    //如果已经有此url,则覆盖,优先保证url不重复
    if (data) {
      proItem.id = data.id;
      datas[data.id] = proItem;
    }
      //新增的则生成新的id
    else if (!proItem.id) {
      proItem.id = util.generalId();
    }
    datas[proItem.id] = proItem;
    var proFilePath = ss.workspace + '\\zproject.json';
    util.writeFileSync(proFilePath, JSON.stringify(datas));
    return { success: true, msg: '保存成功' };
  };

  studio.downFile = function (proItem, fn) {
    proxy.downloadPage(proItem.url)
      .then(function (data) {
        var ss = adv.system.get();
        var filenames = util.url2FileName(data.urlOpt.href),
          path, file;
        if (!filenames.path || !filenames.fileName) {
          filenames = util.url2SiteDir(data.urlOpt.href);
        }
        //如果目标文件为空,则自动生成
        if (!proItem.localFile || !fs.existsSync(proItem.localFile)) {
          path = ss.workspace + filenames.path;
          file = ss.workspace + filenames.path + '\\' + filenames.fileName;
          if (proItem.localFile) {
            var lfArr = proItem.localFile.split('\\');
            path = lfArr.slice(0, lfArr.length - 1).join('\\'),
            file = path + '\\' + lfArr[lfArr.length - 1];
          }
          //递归创建文件所在目录
          util.mkdir(path, true);
          util.writeFileSync(file, data.text);
          proItem.localFile = file;
        }
        else {
          console.log('has');
        }
        studio.saveProItem(proItem);
        //更新目录结构
        //记住最后一次打开的文件
        ss.currentFile = filenames.fileName;
        adv.system.save(ss);
        studio.updateTree();
        fn && fn(proItem);
      });
    return { success: true, msg: '创建成功' };
  };


  //Tree
  var getDirName = function (path) {
    var dirArr = path.split('\\');
    return dirArr[dirArr.length - 1];
  };

  studio.treeNodes = [];


  studio.dirObjToTreeNode = function (path) {
    return pathToTreeNode(path);
  };

  var pathToTreeNode = function (path, parentNode, projectId) {
    var isDir = fs.statSync(path).isDirectory(),
        ipAddres = ip.address(),
        ss = adv.system.get(),
        localUrl = 'http://' + ipAddres + (ss.localServer.port == 80 ? '' : ':' + ss.localServer.port),
        node = {
          name: getDirName(path),
          path: path,
          title: path,
          isDir: isDir,
          isProxy: false
        };
    //将title设置为访问地址
    node.title = localUrl + path.replace(ss.workspace, '').replace(/\\/ig,'/');
    //如果是设置的代理项,则title为代理的页面地址
    var proItems = studio.getProItems();
    for (var key in proItems) {
      if (proItems[key].localFile == node.path) {
        node.title = proItems[key].url;
        node.isProxy = true;
        node.proItemId = proItems[key].id;
      }
    }
    if (isDir) {
      if (!parentNode) {
        node.open = true;
      }
      node.icon = './img/dir.png';
      node.children = [];
      fs.readdirSync(path)
        .forEach(function (file) {
          pathToTreeNode(path + '\\' + file, node);
        });
    } else {
      node.fileType = getFileType(node.name);
      node.icon = generalTypeIcon(node);
    }
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      node.icon = './img/project.png';
      node.isProject = true;
      //node.projectId = projectId;
      return node;
    }
  };


  studio.FILE_TYPES = {
    html: 'html',
    javascript: 'javascript',
    json: 'json',
    css: 'css',
    image: 'image',
    unknow: 'unknow'
  };

  var getFileType = function (fileName) {
    if (~fileName.indexOf(".html")) {
      return studio.FILE_TYPES.html;
    }
    else if (~fileName.indexOf(".js")) {
      return studio.FILE_TYPES.javascript;
    }
    else if (~fileName.indexOf(".json")) {
      return studio.FILE_TYPES.json;
    }
    else if (~fileName.indexOf(".css")) {
      return studio.FILE_TYPES.css;
    } else {
      return studio.FILE_TYPES.unknow;
    }
  };

  var generalTypeIcon = function (node) {
    if (~node.name.indexOf(".html")) {
      return './img/html.png';
    }
    else if (~node.name.indexOf(".js")) {
      return './img/js.png';
    }
    else if (~node.name.indexOf(".css")) {
      return './img/css.png';
    } else {
      return './img/txt.png';
    }
  };
})()