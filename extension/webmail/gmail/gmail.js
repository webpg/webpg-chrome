/* <![CDATA[ */
if (typeof(webpg)=='undefined') { webpg = {}; }
// Enforce jQuery.noConflict if not already performed
if (typeof(jQuery)!='undefined') { webpg.jq = jQuery.noConflict(true); }

/*
    Class: webpg.gmail
        Adds WebPG functionality to gmail
*/
webpg.gmail = {

    /*
        Function: setup
            Sets up the required observers and creates instances to reusable objects

        Parameters:
            navDiv - <obj> The navigation div from the gmail interface we will be working with
    */
    setup: function(navDiv) {
        webpg.utils.sendRequest({
            msg: "gmail_integration" },
            function(response) {
                if (response.result.gmail_integration === "true")
                    webpg.gmail.sign_gmail = (response.result.sign_gmail === 'true');
            }
        );
        if (navDiv.find(".webpg-action-menu").length < 1) {
            // If we are running Mozilla, inject the CSS file
            if (webpg.utils.detectedBrowser.vendor === "mozilla") {
                var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                    .getService(Components.interfaces.nsIStyleSheetService);
                var ios = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
                var uri = ios.newURI("chrome://webpg-firefox/skin/gmail_overlay.css", null, null);
                sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
            }

            var index = (webpg.gmail.gmailComposeType === "inline") ? 1 : 0;

            webpg.gmail.originalWrapValue = webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=nowrap]").val();
            webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=nowrap]").val(1);

            // Create a persistant reference to the Gmail "Send" button
            this.oSendBtn = webpg.jq(navDiv.find('div')[index]);

            // Create a persistant reference to the Gmail "Save" button
            this.oSaveBtn = webpg.jq(navDiv.find('div')[index + 1]);

            // Create a persistant reference to the Gmail "Discard" button
            this.oDisBtn = webpg.jq(navDiv.find('div')[index + 2]);

            // Replace the "Send" button with our own
            this.oSendBtn.clone().insertBefore(this.oSendBtn)
                .attr('id', 'webpg-send-btn')
                .click(this.overrideSend);

            // Hide the original "Send" button
            this.oSendBtn.hide();

            // Replace the "Save" (draft) button with our own
            this.oSaveBtn.clone().insertBefore(this.oSaveBtn)
                .attr('id', 'webpg-save-btn').click(this.overrideSave);

            // Hide the original "Save" button
            this.oSaveBtn.hide();

            // Add the WebPG Options list to the actions menu
            this.addSendOptionBtn(navDiv);

            // Watch for when the mouse exits the TO, CC and BCC fields so we
            //  can check the recipients listed therein
            webpg.gmail.getCanvasFrame().find(
                'textarea, input'
                ).blur(function(e) {
                    if (webpg.gmail.action === 1 || webpg.gmail.action === 3)
                        webpg.gmail.checkRecipients();
                }).bind('mouseleave', function() {
                    if (webpg.gmail.action === 1 || webpg.gmail.action === 3)
                        webpg.gmail.checkRecipients();
                });
        }
    },

    /*
        Function: getCanvasFrame
            Retrieves the gmail UI message editor iframe
    */
    getCanvasFrame: function() {
        if (webpg.utils.detectedBrowser.vendor === "mozilla")
            var cF = webpg.jq(content.document.getElementById("canvas_frame"))
                .length > 0 ? webpg.jq(content.document.getElementById("canvas_frame")) :
                webpg.jq(content.document);
        else
            var cF = webpg.jq('#canvas_frame').length > 0 ?
                webpg.jq('#canvas_frame').contents() : webpg.jq(document);

        return (cF.length) ? cF.contents() :
            (webpg.jq(window.document).contents().length > 1) ?
            webpg.jq(webpg.jq(window.document).contents()[1]) : webpg.jq(window.document).contents();

    },

    /*
        Function: getCanvasFrame
            Retrieves the gmail UI message editor document
    */
    getCanvasFrameDocument: function() {
        var cd =  webpg.gmail.getCanvasFrame()[0].contentDocument;

        return typeof(cd)!='undefined' ? cd :
            (webpg.utils.detectedBrowser.vendor === "mozilla") ? content.document
                : document;
    },

    /*
        Function: refreshText
            Refresh the button text and style to reflect the present state

        Parameters:
            e - <event> The HTML Event dispatched
    */
    refreshText: function(e) {
        if (webpg.utils.detectedBrowser.vendor === "mozilla")
            e.srcElement = e.target;
        if (e.srcElement.getAttribute && e.srcElement.getAttribute("role") === "button") {
            if (e.srcElement.textContent && e.srcElement.textContent.length > 0) {
                var btnType = (e.srcElement.textContent.search("Save") === 0 &&
                    e.srcElement.id.search("webpg") === -1) ?
                    "Save" : "";
                var prevSibling = e.srcElement.previousSibling;
                if (btnType.length > 0 && prevSibling && prevSibling.textContent &&
                prevSibling.textContent != e.srcElement.textContent) {
                    prevSibling.textContent = e.srcElement.textContent;
                    prevSibling.setAttribute("class", e.target.getAttribute("class"));
                }
            }
        }
    },

    /*
        Function: overrideSave
            Modifies the behavior of the gmail Save button to perform certains tasks when saved
    */
    overrideSave: function() {
        webpg.gmail.emulateMouseClick(webpg.gmail.oSaveBtn[0]);
    },

    /*
        Function: overrideSend
            Modifies the behavior of the gmail SEND button to perform certain tasks prior to sending the email
    */
    overrideSend: function() {
        var _ = webpg.utils.i18n.gettext;

        // Retrieve the contents of the message
        webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=ishtml]").val(1);
        var message = (webpg.gmail.action === 0) ? "" :
            webpg.gmail.getContents(webpg.gmail.getCanvasFrame().contents().find('form'));

        webpg.gmail.removeStatusLine();

        // Notification -
        //  webpg.jq(".J-J5-Ji .vh").first().text("Your message has been sent using WebPG").css('visibility', 'visible')

        // Cycle through the available actions until we find the selected
        //  action
        switch (webpg.gmail.action) {

            case 0:
                // No webpg action was selected by the user, simply send
                //  the email without modifying the contents
                webpg.gmail.getCanvasFrame().contents().find('form')
                    .find("input[name=nowrap]").val(webpg.gmail.originalWrapValue);
                webpg.gmail.emulateMouseClick(webpg.gmail.oSendBtn[0]);
                break;

            case 1:
                // Standard GnuPG Encryption was selected; verify the
                //  recipients are valid, encrypt the plaintext and
                //  populate the editor with the result and send
                //  the email.
                webpg.gmail.checkRecipients(function(recipKeys) {
                    var users = [];
                    for (var keyItem in recipKeys) {
                        users.push(recipKeys[keyItem].fingerprint.substr(-16));
                    }
                    if (message.search("-----BEGIN PGP") === 0) {
                        var send = confirm(_("This message already contains PGP data") +
                            "\n\n" + _("Would you like to Encrypt anyway"));
                        if (!send)
                            return;
                    }
                    webpg.utils.sendRequest({'msg': 'encrypt',
                            'data': message,
                            'recipients': users,
                            'message_event': 'gmail'
                        },
                        function(response) {
                            if (!response.result.error && response.result.data) {
                                webpg.gmail.setContents(webpg.gmail.getCanvasFrame().
                                    contents().find('form'),
                                    response.result.data
                                );
                                webpg.gmail.emulateMouseClick(webpg.gmail.oSendBtn[0]);
                            } else {
                                var result = response.result;
                                webpg.gmail.handleFailure(result, recipKeys);
                            }
                        }
                    );
                });
                break;

           case 2:
                // Standard GnuPG Sign was selected; sign the plaintext
                //  and populate the editor with the result and send
                //  the email.
                if (message.search("-----BEGIN PGP") === 0) {
                    var send = confirm(_("This message already contains PGP data") +
                        "\n\n" + _("Would you like to Sign anyway"));
                    if (!send)
                        return;
                }
//                message = webpg.utils.linkify(message).replace(/<(<.*?>)>/gim, "&lt;$1&gt;").trim();
                message += "\n\n";
                webpg.utils.sendRequest({'msg': 'sign',
                    'signers': webpg.gmail.signers,
                    'message_event': 'gmail',
                    'selectionData': {
                        'selectionText': message
                    }
                }, function(response) {
                    if (!response.result.error && response.result.data) {
                        webpg.gmail.setContents(webpg.gmail.getCanvasFrame().
                            contents().find('form'),
                            response.result.data
                        );
                        webpg.gmail.emulateMouseClick(webpg.gmail.oSendBtn[0]);
                    } else {
                        var result = response.result;
                        webpg.gmail.handleFailure(result);
                    }
                });
                break;

            case 3:
                // GnuPG Encrypt & Sign was selected; verify the
                //  recipients are valid, encrypt+sign the plaintext,
                //  populate the editor with the result and send
                //  the email.
                if (message.search("-----BEGIN PGP") === 0) {
                    var send = confirm(_("This message already contains PGP data") +
                        "\n\n" + _("Would you like to Encrypt and Sign anyway"));
                    if (!send)
                        return;
                }
                webpg.gmail.checkRecipients(function(recipKeys) {
                    var users = [];
                    for (var keyItem in recipKeys) {
                        users.push(recipKeys[keyItem].fingerprint.substr(-16));
                    }
                    webpg.utils.sendRequest({'msg': 'encryptSign',
                            'data': message,
                            'recipients': users,
                            'signers': webpg.gmail.signers,
                            'message_event': 'gmail'
                    }, function(response) {
                        if (!response.result.error && response.result.data) {
                            webpg.gmail.setContents(webpg.gmail.getCanvasFrame().
                                contents().find('form'),
                                response.result.data
                            );
                            webpg.gmail.emulateMouseClick(webpg.gmail.oSendBtn[0]);
                        } else {
                            var result = response.result;
                            webpg.gmail.handleFailure(result, recipKeys);
                        }
                    });
                });
                break;

            case 4:
                //  Symmetric encryption was selected; Encrypt the plaintext,
                //  populate the editor with the result and send
                //  the email.
                if (message.search("-----BEGIN PGP") === 0) {
                    var send = confirm(_("This message already contains PGP data") +
                        "\n\n" + _("Would you like to Encrypt anyway"));
                    if (!send)
                        return;
                }
                webpg.utils.sendRequest({'msg': 'symmetricEncrypt',
                        'data': message,
                        'message_event': 'gmail'
                }, function(response) {
                    if (!response.result.error && response.result.data) {
                        webpg.gmail.setContents(webpg.gmail.getCanvasFrame().
                            contents().find('form'),
                            response.result.data
                        );
                        webpg.gmail.emulateMouseClick(webpg.gmail.oSendBtn[0]);
                    } else {
                        var result = response.result;
                        webpg.gmail.handleFailure(result);
                    }
                });
                break;

            default:
                // No webpg action was selected by the user, simply send
                //  the email without modifications
                webpg.gmail.emulateMouseClick(webpg.gmail.oSendBtn[0]);
                break;

        }
    },

    /*
        Function: checkRecipients
            Checks the keyring for the required keys when performing GnuPG methods that require them

        Parameters:
            callback - <func> The function to execute when completed
    */
    checkRecipients: function(callback) {
        var _ = webpg.utils.i18n.gettext,
            status;
        var users = webpg.gmail.getRecipients();
        // Get the keys for the named users/groups
        webpg.utils.sendRequest({'msg': 'getNamedKeys',
            'users': users
        }, function(response) {
            var recipKeys = {};
            var keys = response.result.keys;
            for (var u in keys) {
                recipKeys[u] = keys[u];
            }
            var notAllKeys = false;
            var missingKeys = [];
            for (u in users) {
                if (!(users[u] in recipKeys) || recipKeys[users[u]].length < 1) {
                    notAllKeys = true;
                    missingKeys.push(users[u]);
                }
            }
            // Check for expired keys that are not disabled and inform the user
            var expiredKeys = [];
            for (u in keys) {
              if (keys[u].disabled !== true && keys[u].expired === true) {
                expiredKeys.push(u);
                notAllKeys = true;
              }
            }

            if (notAllKeys) {
                status = "";
                if (missingKeys.length > 0) {
                    status += _("You do not have any keys for") + " " +
                        missingKeys.toString().
                        replace(/((,))/g, " " + _("or") + " ").replace(",", " ");
                }
                if (expiredKeys.length > 0) {
                    status += _("Expired keys found for") + ": " + expiredKeys.toString().
                        replace(/((,))/g, " " + _("and") + " ").replace(",", " ");
                }
                webpg.gmail.displayStatusLine(status, "about");
            } else {
                if (webpg.gmail.action !== 0) {
                  if (webpg.gmail.action === 1)
                    status = _("This message will be Encrypted");
                  else if (webpg.gmail.action === 3)
                    status = _("This message will be Signed and Encrypted");

                  if (webpg.gmail.action === 1 ||
                      webpg.gmail.action === 3) {
                    status += " - Only ";

                    var keylines = [];

                    if (webpg.gmail.encrypt_to_self === true)
                      keylines.push("<span style='text-decoration:underline;'>you</span>");

                    for (var k in recipKeys) {
                      if (k === 0 && keylines.length === 1)
                        keylines.push(',');
                      var key = recipKeys[k];
                      keylines.push(key.uids[0].uid + " (" + key.subkeys[0].algorithm_name + "/" + key.subkeys[0].size + ")");
                    }

                    status += keylines.toString().replace(/((,))/g, " " + _("and") + " ").replace(",", " ");

                    status += " will be able to read the contents of this message";
                  }

                  webpg.gmail.displayStatusLine(status, "webpg");
                }
                if (callback)
                    callback(recipKeys);
            }
        });
    },

    /*
        Function: displayStatusLine
            Adds a status message line to the gmail UI to display information

        Parameters:
            message - <str> The message to display
    */
    displayStatusLine: function(message, icon) {
        var canvasFrame = webpg.gmail.getCanvasFrame(),
            status_line,
            status_msg;

        status_line = webpg.gmail.getCanvasFrame().find(".webpg-status-line");

        if (status_line.length < 1) {
          //status_line = webpg.gmail.getMsgSubjectElement().parent().find("input[name='composeid']").prev();
          status_line = webpg.gmail.getMsgSubjectElement().parent().find("table").first();


          status_msg = status_line
            .find("tr")
            .last()
              .clone()
                .addClass("webpg-status-line")
                .addClass("webpg-gmail-status-line");

          status_msg
            .children()
              .first()
                .next()
                  .prop("colspan", 2)
                .prev()
                  .remove();

          status_line
            .children()
              .first()
                .append(status_msg);

//          status_msg = status_line
//              .clone()
//                .addClass("webpg-status-line")
//                .addClass("webpg-gmail-status-line");
        } else {
          status_msg = status_line;
        }

        status_msg
          .children()
            .first()
            .html("<span style='width:100%'>" +
              "<span class='stat-hold'><img alt='WebPG' title='WebPG' src='" +
              webpg.utils.resourcePath + "skin/images/badges/24x24/" +
              icon + ".png'/></span><span class='stat-hold'><span>" + webpg.descript(message) +
              "</span></span></span>");

        if (webpg.gmail.gmailComposeType === "inline") {
            status_msg.show();
        } else {
            webpg.jq(status_msg).insertBefore(status_line.children(0)).show();
        }

        status_line.find('.keylink').click(function() {
            webpg.utils.sendRequest({
                'msg': "newtab",
                'url': this.id
                }
            );
        });
    },

    /*
        Function: removeStatusLine
            Removes the status message line from the gmail UI
    */
    removeStatusLine: function() {
        webpg.gmail.getCanvasFrame().find(".webpg-status-line").hide();
    },

    /*
        Function: handleFailure
            Determines the details of a GnuPG operation failure and adds status message to the UI

        Parameters:
            result - <obj> The result of the GnuPG operation that failed
            recipKeys - <obj> The recipient keys found (if any)
    */
    handleFailure: function(result, recipKeys) {
        var _ = webpg.utils.i18n.gettext,
            status = "";
        if (result.gpg_error_code === 107) {
            status = result.error_string + ": " +
                result.data + "; " + _("You have more than 1 public key matching that address");
            webpg.gmail.displayStatusLine(status, "about");
        } else if (typeof(result.data)!='undefined' && result.data.length > 0) {
            var invKeyFP = result.data;
            var shortKey = invKeyFP.substr(-16);
            status = "";
            var url = webpg.utils.resourcePath +
                "key_manager.html?auto_init=true" +
                "&tab=-1&openkey=" + shortKey;
            for (var r in recipKeys) {
                var fp = recipKeys[r].fingerprint;
                if (fp === invKeyFP) {
                    status = _("The Key for") + " " + r + " " +
                    _("is invalid") + " [" + webpg.utils.escape(result.
                    error_string) + "] ";
                    if (webpg.gmail.gmailComposeType != "inline") {
                        status += "&nbsp;&nbsp;(<a href='#' class=" +
                            "'keylink' " + "id='" + webpg.utils.escape(url) + "'" +
                            " title='" + _("Open the Key Manager") + "'>" + webpg.utils.escape(shortKey) +
                            "</a>)";
                    }
                    webpg.gmail.displayStatusLine(status, "about");
                }
            }
        } else {
            status = result.error_string;
            webpg.gmail.displayStatusLine(status, "about");
        }
    },

    /*
        Function: emulateMouseClick
            Creates an synthetic mouseclick event for activating the standard gmail UI buttons

        Parameters:
            button - <obj> The target button to click
    */
    emulateMouseClick: function(button) {
        webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=ishtml]").val(0);
        if (webpg.gmail.gmailComposeType === "inline") {
            button.click();
        } else {
            evt = button.ownerDocument.createEvent("MouseEvents");
            evt.initMouseEvent("mousedown", true, false, button.ownerDocument.defaultView, 0, 0, 0, 0, 0,
                false, false, false, false, 0, null);
            button.dispatchEvent(evt);
            evt = button.ownerDocument.createEvent("MouseEvents");
            evt.initMouseEvent("mouseup", true, false, button.ownerDocument.defaultView, 0, 0, 0, 0, 0,
                false, false, false, false, 0, null);
            button.dispatchEvent(evt);
        }
    },

    /*
        Function: getMsgSubjectElement
            Retrieves the element that contains the Subject element
    */
    getMsgSubjectElement: function() {
        return webpg.gmail.getCanvasFrame().find('input[name="subjectbox"]').parent();
    },

    /*
        Function: getRecipients
            Retrieves the recipients in the TO, CC and BCC fields
    */
    getRecipients: function() {
        var emails = [];
        var canvasFrame = webpg.gmail.getCanvasFrame();
        if (webpg.gmail.gmailComposeType === "inline") {
            canvasFrame.find('input[name="to"], input[name="cc"], input[name="bcc"]').each(function(i, e) {
                emails.push(e.value);
            });
        } else {
            emails = canvasFrame.find('textarea[name="to"]').val()
                .replace(', ', ',').split(',');
            if (canvasFrame.find('textarea[name="cc"]').val().length)
                emails = emails.concat(canvasFrame.find('textarea[name="cc"]').val().replace(', ', ',')
                    .replace(' ', '').split(','));
            if (canvasFrame.find('textarea[name="bcc"]').val().length)
                emails = emails.concat(canvasFrame.find('textarea[name="bcc"]').val().replace(', ', ',')
                    .replace(' ', '').split(','));
        }
        var users = [];
        for (var r in emails) {
            if (emails[r].length > 1)
                users.push(emails[r].replace(/((.*)<(.*)>)/g,'$3'));
        }
        return users;
    },

    /*
        Function: addSendOptionBtn
            Creates the WebPG actions menu and adds it to the gmail UI

        Parameters:
            navDiv - <obj> The navigation div from the gmail interface we will be working with
    */
    addSendOptionBtn: function(navDiv) {
        var _ = webpg.utils.i18n.gettext;
        // Set the default action according to the user preference
        webpg.gmail.action = (webpg.gmail.sign_gmail===true) ? 2 : 0;

        if (navDiv.find('#webpg-send-btn').length > 1)
            navDiv.find('#webpg-send-btn').remove();
        if (navDiv.find('#webpg-save-btn').length > 1)
            navDiv.find('#webpg-save-btn').remove();

        var sendBtn = webpg.jq(navDiv.find('div')[0]);
        sendBtn.show();
        var saveBtn = webpg.jq(navDiv.find('div')[1]);
        saveBtn.show();
        var disBtn = webpg.jq(navDiv.find('div')[2]);
        disBtn.show();

        var cssClass = (webpg.gmail.gmailComposeType === "inline") ?
                "webpg-gmail-compose-inline" : "webpg-gmail-compose-normal";

        var esBtn = disBtn.clone().insertBefore(saveBtn.first())
            .attr('id', 'webpg-action-menu')
            .addClass(cssClass)
            .attr('style', 'width: auto;')
            .show();

        if (webpg.utils.isRTL())
            esBtn.addClass("rtl");

        this.oSendBtn.hide();

        var action_menu = '' +
            '<span class="webpg-action-menu">' +
                '<span class="webpg-current-action" style="line-height:inherit;">' +
                    '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + "skin/images/badges/32x32/webpg.png" + '" width="17" height="17"/>' +
                    '<span class="webpg-action-text">WebPG</span>' +
                '</span>' +
                '&nbsp;' +
                '<span class="webpg-action-list-icon">' +
                    '&nbsp;' +
                '</span>' +
            '</span>';

        var action_list = '' +
            '<span style="z-index:4;">' +
                '<ul class="webpg-action-list webpg-gmail-compose-' + webpg.gmail.gmailComposeType + '">' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-encrypt">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_encrypted.png" class="webpg-li-icon"/>' +
                            _('Encrypt') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-sign" style="display:inline-block;">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_signature.png" class="webpg-li-icon"/>' +
                            _('Sign only') +
                        '</a>' +
                        '<ul class="webpg-toolbar-sign-callout" style="top:0;' +
                            'right:4px;width:20px;display:inline-block;' +
                            'position:absolute;padding:0;">' +
                            '<li class="webpg-subaction-btn">' +
                                '<span class="webpg-action-list-icon">' +
                                    '&nbsp;' +
                                '</span>' +
                            '</li>' +
                        '</ul>' +
                        '<ul class="webpg-subaction-list">' +
                            webpg.inline.createSecretKeySubmenu('sign', 'sign') +
                        '</ul>' +
                    '</li>' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-cryptsign">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_encrypted_signed.png" class="webpg-li-icon"/>' +
                            _('Sign and Encrypt') +
                        '</a>' +
                        '<ul class="webpg-toolbar-sign-callout" style="top:0;right:4px;width:20px;display:inline-block;position:absolute;padding:0;">' +
                            '<li class="webpg-subaction-btn">' +
                                '<span class="webpg-action-list-icon">' +
                                    '&nbsp;' +
                                '</span>' +
                            '</li>' +
                        '</ul>' +
                        '<ul class="webpg-subaction-list">' +
                            webpg.inline.createSecretKeySubmenu('sign', 'cryptsign') +
                        '</ul>' +
                    '</li>' +
                    '<li class="webpg-action-btn">' +
                        '<a class="webpg-toolbar-symcrypt">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_encrypted.png" class="webpg-li-icon"/>' +
                            _('Symmetric Encryption') +
                        '</a>' +
                    '</li>' +
                    '<li class="webpg-action-btn webpg-none-btn">' +
                        '<a class="webpg-toolbar-btn-none">' +
                            '<img src="' + webpg.utils.escape(webpg.utils.resourcePath) + 'skin/images/badges/20x20/stock_decrypted-signature-bad.png" class="webpg-li-icon"/>' +
                            _('Do not use WebPG for this message') +
                        '</a>' +
                    '</li>' +
                '</ul>' +
            '</span>';

        if (webpg.gmail.gmailComposeType === "inline") {
            esBtn.html(action_menu);
            var canvasFrame = webpg.gmail.getCanvasFrame();
            var action_list_el = webpg.gmail.getCanvasFrameDocument().createElement("span");
            webpg.jq(action_list_el).html(action_list);
            if (webpg.gmail.getCanvasFrame().find(".Hp").length < 1) {
                navDiv.context.ownerDocument.querySelector('.aDh').appendChild(action_list_el);
            } else {
                navDiv.context.ownerDocument.querySelector('div>.nH.nH .aaZ, div>.nH.nH .ip.adB').firstChild.appendChild(action_list_el);
            }
            webpg.gmail.action_list = webpg.jq(action_list_el).find('ul.webpg-action-list');
            webpg.inline.createWebPGActionMenu(action_list_el, esBtn);
        } else {
            esBtn.html(action_menu + action_list);
            webpg.gmail.action_list = esBtn.find('ul.webpg-action-list');
            webpg.inline.createWebPGActionMenu(esBtn, esBtn);
        }

        esBtn.click(function(e) {
            if (e.target.className != "webpg-subaction-btn" &&
            e.target.parentElement.className != "webpg-subaction-btn") {
                webpg.gmail.action_list.css({
                    'display': (webpg.gmail.action_list[0].style.display === 'inline') ? 'none' : 'inline'
                });
                webpg.gmail.action_list.find('.webpg-subaction-list').hide();
                if (webpg.gmail.gmailComposeType === "inline") {
                    webpg.gmail.action_list.find('ul.webpg-subaction-list').css({'top': 'auto', 'bottom': '0'});
                }
            }
        });

        webpg.gmail.action_list.bind('mouseleave', function(e) {
            webpg.jq(this).hide();
        });

        webpg.gmail.action_list.find('a').click(function(e) {
            var action = this.className.split("-")[2];

            var signers = (this.id.indexOf("0x") > -1) ? null : [webpg.inline.default_key()];

            if ((action === "sign" ||
            action === "cryptsign") &&
            this.id.indexOf("0x") === -1 &&
            webpg.inline.default_key() === undefined) {
                e.stopImmediatePropagation();
                e.preventDefault();
                e.stopPropagation();
                webpg.jq(this).next().find('.webpg-subaction-btn').click();
                return false;
            }

            var newIcon = (this.id.indexOf("0x") > -1) ?
                webpg.jq(this).parent().parent().parent().find('a img.webpg-li-icon')[0] :
                webpg.jq(this).find("img")[0];

            var newText = (this.id.indexOf("0x") > -1) ?
                webpg.jq(this).parent().parent().parent().find('a').first().text() :
                webpg.jq(this).text();

            if (webpg.gmail.gmailComposeType === "inline") {
                newText = "WebPG";
                esBtn.click();
            }

            webpg.jq(esBtn).find(".webpg-current-action").find("img").attr({'src': newIcon.src});
            webpg.jq(esBtn).find(".webpg-action-text").text(webpg.utils.escape(newText));
            esBtn.firstStatusText = null;
            var composeCSS = {
                'background-image': 'none',
                'background-repeat': 'no-repeat',
                'background-position': 'bottom right'
            };
            var bgBasePath = webpg.utils.resourcePath + 'skin/images/badges/48x48/';

            switch (action) {

                case "encrypt":
                    webpg.gmail.checkRecipients();
                    webpg.gmail.action = 1;
                    esBtn.attr('data-tooltip', _("Encrypt"));
                    composeCSS['background-image'] = 'url(' + bgBasePath + 'stock_encrypted.png' + ')';
                    break;

                case "sign":
                    webpg.gmail.displayStatusLine(_("This message will be Signed"), "webpg");
                    webpg.gmail.action = 2;
                    esBtn.attr('data-tooltip', _("Sign Only"));
                    composeCSS['background-image'] = 'url(' + bgBasePath + 'stock_signature.png' + ')';
                    break;

                case "cryptsign":
                    webpg.gmail.checkRecipients();
                    webpg.gmail.action = 3;
                    esBtn.attr('data-tooltip', _("Sign and Encrypt"));
                    composeCSS['background-image'] = 'url(' + bgBasePath + 'stock_encrypted_signed.png' + ')';
                    break;

                case "symcrypt":
                    webpg.gmail.displayStatusLine(_("This message will be Encrypted using Symmetric Encryption"), "webpg");
                    webpg.gmail.action = 4;
                    esBtn.attr('data-tooltip', _("Symmetric Encryption"));
                    composeCSS['background-image'] = 'url(' + bgBasePath + 'stock_encrypted.png' + ')';
                    break;

                default:
                    webpg.gmail.removeStatusLine();
                    webpg.gmail.action = 0;
                    esBtn.attr('data-tooltip', _("Do not use WebPG for this message"));
                    composeCSS['background-image'] = 'none';
            }

            webpg.gmail.signers = (this.id.search("0x") === 0) ?
                    [e.currentTarget.id.substr(2)] : signers;

            var msg_container = webpg.gmail.getEditor(webpg.gmail.getCanvasFrame().contents().find('form'));
            if (msg_container.length > 0)
                msg_container.css(composeCSS);

            if (this.id.search("0x") === 0) {
                webpg.jq(this).parent().parent().find('a img').css({'opacity': '0'});
                webpg.jq(this).find('img').css({'opacity': '1.0'});
            }
        });

        if (webpg.gmail.action === 2) {
            var composeCSS = {
                'background-image': 'url(' + webpg.utils.resourcePath + 'skin/images/badges/48x48/stock_signature.png' + ')',
                'background-repeat': 'no-repeat',
                'background-position': 'bottom right'
            };
            var msg_container = webpg.gmail.getEditor(webpg.gmail.getCanvasFrame().contents().find('form'));
            if (msg_container.length > 0)
                msg_container.css(composeCSS);
        }

        if (webpg.gmail.sign_gmail)
            webpg.jq(esBtn).find(".webpg-current-action").find("img")
                .attr({'src': webpg.utils.resourcePath +
                    'skin/images/badges/48x48/stock_signature.png'});
    },

    getEditor: function(editor) {
        var canvasFrame = webpg.gmail.getCanvasFrame();
        if (webpg.gmail.gmailComposeType === "inline") {
            var msg_container = canvasFrame.find("*[g_editable='true']").first();
            if (msg_container.length < 1) {
                // The editor must be in an iframe
                var iframes = canvasFrame.find("iframe");
                iframes.each(function() {
                    if (webpg.jq(this.contentDocument).find("*[g_editable='true']").length > 0)
                        msg_container = webpg.jq(this.contentDocument).find("*[g_editable='true']").first();
                });
            }
            return msg_container;
        } else {
            var textarea = canvasFrame.find('textarea[name!=to]', editor).
                filter("[name!=bcc]").filter("[name!=cc]");
            var iframe = webpg.jq('iframe', editor).contents().find('body');
            if (iframe.length > 0) {
                return iframe;
            } else {
                return textarea;
            }
        }
    },

    /*
        Function: getContents
            Retrieves the contents of the gmail UI message editor

        Parameters:
            editor - <editor> The editor instance to use as the context
    */
    getContents: function(editor) {
        var canvasFrame = webpg.gmail.getCanvasFrame(),
            plaintext = (webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=ishtml]").val() != "1"),
            message = "";
        if (webpg.gmail.gmailComposeType === "inline") {
            var msg_container = canvasFrame.find("*[g_editable='true']").first();
            if (msg_container.length < 1) {
                // The editor must be in an iframe
                var iframes = canvasFrame.find("iframe");
                iframes.each(function() {
                    if (webpg.jq(this.contentDocument).find("*[g_editable='true']").length > 0)
                        msg_container = webpg.jq(this.contentDocument).find("*[g_editable='true']").first();
                });
            }
            webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=ishtml]").val(1);
            message = (msg_container[0].nodeName === "TEXTAREA") ?
                msg_container.val() : webpg.utils.getInnerText(msg_container[0]);
        } else {
            var textarea = canvasFrame.find('textarea[name!=to]', editor).
                filter("[name!=bcc]").filter("[name!=cc]");
            var iframe = webpg.jq('iframe', editor).contents().find('body');
            if (iframe.length > 0) {
                message = iframe.html();
            } else {
                message = textarea.val();
                plaintext = true;
            }
        }

        message = webpg.utils.gmailWrapping(message);
        return message;
    },

    /*
        Function: setContents
            Sets the contents of the gmail UI message editor

        Parameters:
            editor - <obj> The editor instance to use as the context
            message - <str/html> The content to place in the gmail UI message editor
    */
    setContents: function(editor, message) {
        var canvasFrame = webpg.gmail.getCanvasFrame();
        if (webpg.gmail.gmailComposeType === "inline") {
            var msg_container = canvasFrame.find("*[g_editable='true']").first();
            if (msg_container.length < 1) {
                // The editor must be in an iframe
                var iframes = canvasFrame.find("iframe");
                iframes.each(function() {
                    if (webpg.jq(this.contentDocument).find("*[g_editable='true']").length > 0)
                        msg_container = webpg.jq(this.contentDocument).find("*[g_editable='true']").first();
                });
            }
            if (msg_container.length > 0) {
                // Determine if we are in plaintext mode or inline mode
                var plaintext = (webpg.gmail.getCanvasFrame().contents().find('form').find("input[name=ishtml]").val() != "1");
                //console.log((plaintext) ? "plaintext" : "richtext");
                if (msg_container[0].nodeName === "TEXTAREA") {
                    msg_container.val(message);
                } else {
                    if (plaintext) {
                        //console.log("PLAINTEXT");
                        if (webpg.utils.detectedBrowser.vendor === 'mozilla') {
                            msg_container[0].innerHTML = message.replace(/\n/gim, "<br>").replace(/</gim, "&lt;").replace(/>/, "&gt;");
                        } else {
                            msg_container[0].innerText = message;
                        }
                    } else {
                        //console.log("RICHTEXT");
                        msg_container.html(message.replace(/\n/gim, "<br>"));
                    }
                }
            }
        } else {
            var textarea = webpg.jq('textarea[name!=to]', editor).
                filter("[name!=bcc]").filter("[name!=cc]");
            var iframe = webpg.jq('iframe', editor).contents().find('body');

            if (iframe.length > 0) {
                iframe.html(message);
            } else {
                textarea.val(message);
            }
        }
    },

    /*
        Function: gmailChanges
            Called when the DOM changes. Watches for our queue in DOM modifications to add the webpg related controls

        Parameters:
            e - <event> The HTML Event dispatched
    */
    gmailChanges: function(e) {
        if (!e.target || e.target.nodeName !== "DIV")
            return;

        if (e.target.parentElement === null ||
        (e.target.parentElement.className === undefined ||
          e.target.parentElement.className === "" ||
          e.target.parentElement.className === "gmail_quote"))
            return;

        if (e.target.ownerDocument.location.hash.search("#settings") !== -1)
            return;

        if (e.target.parentElement &&
            typeof(e.target.parentElement.className)!="undefined" &&
            e.target.parentElement.className.search("dW E") > -1) {
            // do notihng here; this event originates most likely from our
            //  button creation in a normal compose window

        } else if (e.target.parentElement &&
            typeof(e.target.parentElement.className)!="undefined" &&
            e.target.parentElement.className.search("gU Up") > -1) {
            // do notihng here; this event originates most likely from our
            //  button creation in an inline compose window

        } else if (e.target &&
            e.target.className === 'gs') {

            if (e.addedNodes &&
                e.addedNodes[0].className.search('webpg') !== -1)
              return;

            webpg.utils.gmailNotify("WebPG is checking this message for signatures", 8000);
            // A message is being displayed
            var node = e.previousSibling,
                msgClassList,
                userEmail,
                gmailID,
                msgID,
                hasPGPData = (webpg.jq(node).text().search(/(^\s*?)?(-----BEGIN PGP.*?)/gi) !== -1),
                hasAttachment = (webpg.jq(node.parentElement).html().search("download_url=") !== -1 ||
                                 webpg.jq(node.parentElement).find('.f.gW').length > 0);

          // Check if the PGP data is already present for this message
          if (hasPGPData === true || (hasPGPData === false && hasAttachment === true)) {
            // Notify the user something is going on
            // lets get information about the current email message
            if (webpg.utils.detectedBrowser['vendor'] === 'mozilla') {
              var GLOBALS = node.ownerDocument.defaultView.wrappedJSObject.GLOBALS;
            } else {
              var GLOBALS = webpg.gmail.GLOBALS;
            }
            // Obtain the class list (which contains the msg ID)
            msgClassList = node.className.split(" ");
            if (msgClassList.hasOwnProperty(2)) {
              msgID = msgClassList[2];
              // Obtain the users email address
              var emailRegex = new RegExp(/sx_mrsp_(.*?)\,/igm);
              var regRes = emailRegex.exec(GLOBALS);
              // If the address was found, use it to find the gmail user ID
              if (regRes && regRes.hasOwnProperty(1)) {
                userEmail = regRes[1];
                gmailID = GLOBALS[GLOBALS.indexOf(userEmail) - 1];
              }
              msgLink = node.ownerDocument.location.href.split("#")[0] + "?ui=2&ik=" + gmailID + "&view=om&th=" + msgID.substr(1);
              webpg.jq.ajax({
                'url': msgLink,
                'success': function(msgData, status) {
                  var msgObj = null,
                      signature = null,
                      data,
                      encoding,
                      dataEncoding,
                      plaintextHeaders = [],
                      blockType,
                      dataEnd = "";

                  msgObj = webpg.utils.parseMailMessage(msgData);

                  if (msgObj && msgObj.multipart === true)
                    msgObj = webpg.utils.getPGPMimeMsg(msgObj);

                  if (node && msgObj) {
                    if (msgObj.multipart === true && msgObj.parts.length !== 0) {
                      if (msgObj.headers.content_type.type === "multipart/signed") {
                        if (msgObj.parts[0].multipart === true) {
                          dataEnd = '\n';
                          data = msgObj.content;
                          dataEncoding = msgObj.parts[0].headers.content_transfer_encoding;
                          signature = msgObj.parts[1].body;
                          encoding = (msgObj.parts[0].headers.content_transfer_encoding || "").toLowerCase()
                        } else {
                          dataEnd = '\n\n';
                          signature = msgObj.parts[1].body;
                          data = msgObj.parts[0].headers.full_headers + msgObj.parts[0].content;
                          dataEncoding = msgObj.parts[0].headers.content_transfer_encoding;
                          encoding = (msgObj.parts[1].headers.content_transfer_encoding || "").toLowerCase();
                          plaintextHeaders = msgObj.parts[1].headers.full_headers;
                        }
                      } else if (msgObj.headers.content_type.type === "multipart/encrypted") {
                        data = msgObj.parts[1].body;
                      }
                    } else if (msgObj.hasOwnProperty('parts') === true &&
                               msgObj.parts.hasOwnProperty(0) === true &&
                               msgObj.parts[0].content.length > 1) {
                        data = msgObj.parts[0].content;
                        encoding = (msgObj.parts[0].headers && msgObj.parts[0].headers.content_transfer_encoding || "").toLowerCase()
                    } else if (msgObj.hasOwnProperty('content') === true) {
                        data = msgObj.content;
                    }

                    if (dataEncoding === 'quoted_printable' ||
                        dataEncoding === 'qouted-printable')
                      data = webpg.utils.quoted_printable_decode(data);
                    else if (dataEncoding === 'base64')
                      data = webpg.utils.base64_decode(data);

                    if (encoding === 'quoted_printable' ||
                        encoding === 'quoted-printable')
                      signature = (webpg.utils.quoted_printable_decode(signature) || null);
                    else if (encoding === 'base64')
                      signature = (webpg.utils.base64(signature) || null);

                    var doc = (node.ownerDocument || webpg.inline.doc || content.document || document);

                    var pgpData = (signature || data); // If this is signed data, the PGP data is the signature
                    if (pgpData === null || pgpData.length < 1)
                      return;

                    webpg.jq(node.firstChild).hide(); // Hide the gmail message content
                    var results_frame = webpg.inline.addResultsFrame(node, node);

                    var originalNodeData = doc.createElement("span");
                    originalNodeData.setAttribute("class", "webpg-node-odata");
                    originalNodeData.setAttribute("style", "white-space: pre;");
                    originalNodeData.setAttribute("id", "webpg-node-odata-" + results_frame.id);
                    originalNodeData.textContent = data;

                    webpg.jq(originalNodeData).insertBefore(results_frame);

                    var posX = webpg.jq(originalNodeData).width() - 60;
                    var scrollElement = webpg.jq(originalNodeData).parents().find(".Tm.aeJ");

                    var badge = webpg.inline.addElementBadge(doc, posX, results_frame.id, originalNodeData, scrollElement);
                    originalNodeData.appendChild(badge);

                    plaintext = (signature === null) ? null : (data.substr(0, data.length).trim() + dataEnd || ""); // If this is a detached signature, the plaintext will be data

                    webpg.utils.sendRequest({
                        'msg': 'verify',
                        'data': pgpData,
                        'plaintext': plaintext,
                        'target_id': results_frame.id},
                        function(response) {
                            if (response.result.message_type === "detached_signature" ||
                                (response.result.signatures && response.result.data))
                                blockType = webpg.constants.PGPBlocks.PGP_SIGNED_MSG;
                            else
                                blockType = webpg.constants.PGPBlocks.PGP_ENCRYPTED;

                            if (plaintext !== null) {
                              response.result.original_text = plaintext + '\n' + pgpData;
                              response.result.data = (plaintextHeaders.length > 0 ? plaintext.split(/[\r\n][\r\n]/)[1] : plaintext || plaintext);
                            }
                            webpg.utils.sendRequest({
                                'msg': "sendtoiframe",
                                'block_type': blockType,
                                'target_id': results_frame.id,
                                'verify_result': response.result
                            });
                            if (webpg.utils.detectedBrowser.vendor === "mozilla") {
                                webpg.utils.sendRequest({
                                    'msg': "sendtoiframe",
                                    'block_type': blockType,
                                    'target_id': results_frame.id,
                                    'verify_result': response.result
                                });
                            } else {
                                results_frame.onload = function() {
                                    webpg.utils.sendRequest({
                                        'msg': "sendtoiframe",
                                        'block_type': blockType,
                                        'target_id': results_frame.id,
                                        'verify_result': response.result
                                    });
                                };
                            }
                            webpg.utils.gmailCancelNotify();
                        }
                    );

                    if (webpg.inline.mode === "window") {
                        webpg.jq(originalNodeData).hide();
                        webpg.jq(badge).hide();
                    }
                  } else {
                    webpg.utils.gmailCancelNotify();
                  }
                },
                'async': true
              });
            }
          } else {
            webpg.utils.gmailCancelNotify();
          }
        // A normal document load
        } else {
            if (e.target.getAttribute && e.target.getAttribute("role") === "document") {
              if (e.addedNodes && e.addedNodes.length > 0 &&
                  e.addedNodes[0].data !== undefined &&
                  e.addedNodes[0].data.search("-----BEGIN PGP") === 0) {
                webpg.inline.PGPDataSearch(e.target.ownerDocument, true, false, e.target);
              }
              return;
            }
            if (e.target.getAttribute && e.target.getAttribute("role") !== null)
                return;

            var dW = webpg.gmail.getCanvasFrameDocument()
                .querySelectorAll("div>.dW.E>.J-Jw, div>.nH.nH");

            for (var i in dW) {
                if (typeof(dW[i])!=="object")
                    break;

                if (dW[i].querySelectorAll("[id*='webpg-send-btn']").length < 1) {
                    var btn = dW[i].querySelector('div>.dW.E>.J-Jw>.T-I.J-J5-Ji.Bq.T-I-ax7.L3, div>.nH.nH .T-I.J-J5-Ji.aoO.T-I-atl');
                    if (btn) {
                        webpg.jq(dW[i]).addClass("webpg-modified");
                        var navDiv = btn.parentElement;
                        webpg.gmail.gmailComposeType = (navDiv.className === "J-J5-Ji") ? 'inline' : 'normal';
                        if (navDiv)
                            webpg.gmail.setup(webpg.jq(navDiv));
                    }
                }
           }
        }
    }
};

// Check if gmail_integration is enabled and set appropriate listeners.
webpg.utils.sendRequest({
    msg: "gmail_integration" },
    function(response) {
        if (response.result.gmail_integration === "true") {
            webpg.gmail.sign_gmail = (response.result.sign_gmail === 'true');
            webpg.gmail.encrypt_to_self = (response.result.encrypt_to_self === 'true');
            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
            // Retrieve a reference to the appropriate window object
            // Check if the MutationObserver is not present
            if (typeof(MutationObserver) === 'undefined') {
                console.log("Using depreciated DOMSubtreeModified");
                if (webpg.utils.detectedBrowser.vendor === "mozilla") {
                    webpg.gmail.appcontent = document.getElementById("appcontent") || document;
                    webpg.gmail.appcontent.addEventListener("DOMContentLoaded",
                        function(aEvent) {
                            // We need to filter based on the URL for mozilla, as we do
                            //  not have the option to set the overlay by URL
                            if (aEvent.originalTarget.location.host === "mail.google.com") {
                                webpg.gmail.getCanvasFrameDocument()
                                .addEventListener("DOMSubtreeModified",
                                    webpg.gmail.gmailChanges, false
                                );
                            }
                        },
                    true);
                } else {
                    window.addEventListener("DOMSubtreeModified",
                        webpg.gmail.gmailChanges, false);
                }
            } else {
                // Otherwise, use the MutationObserver
                // create an observer instance

                if (webpg.gmail_observer !== undefined)
                  webpg.gmail_observer.disconnect();

                webpg.gmail_observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        webpg.gmail.gmailChanges(mutation);
                    });
                });

                // configuration of the observer:
                var config = { 'childList': true, 'subtree': true, 'attributes': false, 'characterData': false };

                if (webpg.utils.detectedBrowser.vendor === "mozilla") {
                    webpg.gmail.appcontent = document.getElementById("appcontent") || document;
                    webpg.gmail.appcontent.addEventListener("DOMContentLoaded",
                        function(aEvent) {
                            // We need to filter based on the URL for mozilla, as we do
                            //  not have the option to set the overlay by URL
                            if (aEvent.originalTarget.location.host === "mail.google.com") {
                                webpg.gmail_observer.observe(webpg.gmail.getCanvasFrameDocument(), config);
                                webpg.gmail.appcontent.removeEventListener("DOMContentLoaded", arguments.callee, true);
                            }
                        },
                        false
                    );
                } else {
                    webpg.gmail_observer.observe(document.querySelector('body'), config);
                }
            }
        }
    }
);

/* ]]> */
