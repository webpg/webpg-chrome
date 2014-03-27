/* <![CDATA[ */
if (typeof(webpg)=='undefined') { webpg = {}; }
// Enforce jQuery.noConflict if not already performed
if (typeof(jQuery)!='undefined') { webpg.jq = jQuery.noConflict(true); }

/*
    Class: webpg.options
        Provides the methods for the options page
*/
webpg.options = {

    /*
        Function: init
            Sets up the required references to webpg.background,
            and performs initial plugin tests

        Parameters:
            browserWindow - <window> The Window object housing firefoxOverlay.xul
            or thunderbirdOverlay.xul in Mozilla applications - not passed in Google Chrome
    */
    init: function(browserWindow)
    {
        var _ = webpg.utils.i18n.gettext;
        document.title = _("WebPG Options");
        document.dir = (webpg.utils.isRTL() ? 'rtl' : 'ltr');
        if (webpg.utils.detectedBrowser.vendor == "mozilla")
        {
            webpg.plugin = browserWindow.webpg.plugin;
        }
        else if (webpg.utils.detectedBrowser.product == "chrome")
        {
            webpg.plugin = chrome.extension.getBackgroundPage().webpg.plugin;
        }
        
        // jQuery UI elements
        webpg.jq('#tabs').tabs();

        webpg.jq('#step-1').ready(function() {
            doSystemCheck();
        });

        function doSystemCheck() {
            var _ = webpg.utils.i18n.gettext;
            if (webpg.utils.detectedBrowser.product == "chrome")
                pf = window.clientInformation.platform.substr(0,3);
            else
                pf = navigator.oscpu.substr(0,3);
            platform = "";
            if (pf == "Win") {
                platform = "-mswindows";
            }
            else if (pf == "Mac") {
                platform = "-macosx";
            }
            if (webpg.plugin && webpg.plugin.valid) {
                webpg_status = webpg.plugin.webpg_status;
                errors = {
                    'NPAPI' : { 'error' : false, 'detail': _("The WebPG NPAPI Plugin is valid") + "; version " + webpg.plugin.version },
                    'openpgp' : { 'error' : false, 'detail' : _("OpenPGP was detected") + "; version " + webpg_status.OpenPGP.version },
                    'gpg_agent' : { 'error' : false, 'detail' : _("It appears you have a key-agent configured") },
                    'gpgconf' : { 'error' : false, 'detail' : _("gpgconf was detected") + "; " +  _("you can use the signature methods") }
                };

                if (!webpg_status.openpgp_detected) {
                    errors.openpgp = {
                        'error': true,
                        'detail': _("OpenPGP does not appear to be installed"),
                        'link' : "https://webpg.org/docs/webpg-userdocs/#!/guide/prerequisites"
                    };
                }

                if (!webpg_status.gpg_agent_info) {
                    errors.gpg_agent = {
                        'error': true,
                        'detail': _("You do not appear to have a key-agent configured") + " " + _("A working key-agent is required"),
                        'link' : "https://webpg.org/docs/webpg-userdocs/#!/guide/prerequisites"
                    };
                }

                if (!webpg_status.gpgconf_detected) {
                    errors.gpgconf = {
                        'error': true,
                        'detail': _("gpgconf does not appear to be installed") + "; " + _("You will not be able to create signatures"),
                        'link' : "https://webpg.org/docs/webpg-userdocs/#!/guide/prerequisites-section-windows"
                    };
                }

            } else {
                errors = {
                "NPAPI" : {
                        'error': true,
                        'detail': _("There was a problem loading the plugin") + "; " + _("the plugin might be incompatibly compiled for this architechture"),
                        'link' : null
                    }
                };
                webpg.jq('#valid-options').hide();
                console.log(errors.NPAPI.detail);
            }
            errors_found = false;
            for (var error in errors) {
                if (errors[error].error) {
                    document.getElementById('system-good').style.display = 'none';
                    document.getElementById('system-error').style.display = 'block';
                    errors_found = true;
                }
                extra_class = (errors[error].error && error != 'gpgconf') ? ' error' : '';
                extra_class = (errors[error].error && error == 'gpgconf') ? ' warning' : extra_class;
                item_result = webpg.jq("<div></div>", {
                    'class': "trust-level-desc" + extra_class
                }).append(webpg.jq("<span></span>", {
                        'class': "system-check",
                        'style': "margin-right: 8px"
                    }).append(webpg.jq("<img/>", {
                            'src': (errors[error].error) ?
                                "skin/images/cancel.png" : "skin/images/check.png"
                        })
                    )
                ).append(webpg.jq("<span></span>", {
                        'class': "trust-desc",
                        'html': (errors[error].error && errors[error].link) ? 
                            errors[error].detail + " - <a href=\"" + errors[error].link + platform + "/\" target=\"new\">" + _("click here for help resolving this issue") + "</a>" : errors[error].detail
                    })
                );
                webpg.jq('#status_result').append(item_result);
            }
            if (errors_found && error == 'NPAPI') {
                // Hide the options for invalid installations
                webpg.jq('#valid-options').hide();
            } else {
                // Only display the inline check if this is not the app version of webpg-chrome.
                // and don't show the "GMAIL integration" option in Thunderbird
                if (webpg.utils.detectedBrowser.product == "thunderbird") {
                    webpg.jq("#enable-gmail-integration").hide();
                    webpg.jq("#gmail-action-sign").hide();
                    webpg.jq("#gmail-linked-identities").hide();
                }

                if (webpg.preferences.gmail_integration.get() !== 'true') {
                    webpg.jq("#gmail-action-sign").hide();
                    //webpg.jq("#gmail-linked-identities").hide();
                }

                if ((webpg.utils.detectedBrowser.product == "chrome") &&
                    !chrome.app.getDetails().hasOwnProperty("content_scripts")) {
                        webpg.jq('#enable-decorate-inline').hide();
                } else {
                    webpg.jq('#enable-decorate-inline-check')[0].checked = 
                        (webpg.preferences.decorate_inline.get() == 'true');
                    if (!webpg.jq('#enable-decorate-inline-check')[0].checked ||
                    webpg.utils.detectedBrowser.product == "thunderbird")
                        webpg.jq("#inline-options-link").hide();
                }

                // If no errors were found in the configuration, only display
                //  the "good-to-go" status item
                if (!errors_found) {
                    webpg.jq('#status_result').children().hide();
                    webpg.jq("#system-good").show();
                }

                webpg.jq(".webpg-options-title").first().text(_("WebPG Options"));

                webpg.jq("#enable-decorate-inline").find(".webpg-options-text").
                    text(_("Enable Inline formatting of PGP Messages and Keys"));

                webpg.jq("#inline-options-link").text(_("Inline Options"));

                webpg.jq("#enable-encrypt-to-self").find(".webpg-options-text").
                    text(_("Always encrypt to your default key in addition to the recipient"));

                webpg.jq("#enable-gmail-integration").find(".webpg-options-text").
                    text(_("Enable WebPG GMAIL integration") + " [" + _("EXPERIMENTAL") + "]");

                webpg.jq("#gmail-action-sign").find(".webpg-options-text").
                    text(_("Automatically Sign outgoing messages in GMAIL"));

                webpg.jq("#gmail-linked-identities").find(".webpg-options-text").
                    text(_("Linked GMAIL Identities"));
                
                webpg.jq("#link-gmail-identity").text(_("Link new GMAIL identity")).click(function() {
                    webpg.xoauth2.requestCodeCallback = function() {
                        webpg.xoauth2.requestCodeCallback = undefined;
                        document.location.reload();
                    };
                    webpg.xoauth2.requestCode();
                });

                webpg.jq("#gnupg-path-select").find(".webpg-options-text").
                    text(_("GnuPG home directory"));
                webpg.jq("#gnupg-path-select").find("input:button").val(_("Save"));
                webpg.jq("#gnupg-path-input").attr('placeholder', '~/.gnupg');

                webpg.jq("#gnupg-binary-select").find(".webpg-options-text").
                    text(_("GnuPG binary"));
                webpg.jq("#gnupg-binary-input").attr('placeholder', '/usr/bin/gpg');
                webpg.jq("#gnupg-binary-select").find("input:button").val(_("Save"));

                webpg.jq("#gpgconf-binary-select").find(".webpg-options-text").
                    text(_("GPGCONF binary"));
                webpg.jq("#gpgconf-binary-input").attr('placeholder', '/usr/bin/gpgconf');
                webpg.jq("#gpgconf-binary-select").find("input:button").val(_("Save"));

                webpg.jq("#gnupg-keyserver-select").find(".webpg-options-text").
                    text(_("Keyserver"));
                webpg.jq("#gnupg-keyserver-input").attr('placeholder', 'hkp://subkeys.pgp.net');
                webpg.jq("#gnupg-keyserver-select").find("input:button").val(_("Save"));

                webpg.jq("#system-good").find(".trust-desc").text(_("Your system appears to be configured correctly for WebPG"));

                webpg.jq("#system-error").find(".trust-desc").text(_("There is a problem with your configuration"));

                webpg.jq('#enable-encrypt-to-self-check')[0].checked = 
                    (webpg.preferences.encrypt_to_self.get());

                if (webpg.preferences.default_key.get() === "")
                    webpg.jq('#enable-encrypt-to-self-check')[0].disabled = true;

                webpg.jq('#enable-gmail-integration-check')[0].checked = 
                    (webpg.preferences.gmail_integration.get() == 'true');

                webpg.jq('#gmail-action-sign-check')[0].checked = 
                    (webpg.preferences.sign_gmail.get() == 'true');

                webpg.jq('#enable-decorate-inline-check').button({
                    'label': (webpg.preferences.decorate_inline.get() == 'true') ? _('Enabled') : _('Disabled')
                    }).click(function(e) {
                        var status;
                        if (webpg.preferences.decorate_inline.get() == 'true') {
                            webpg.preferences.decorate_inline.set(false);
                            status = _("Disabled");
                            this.checked = false;
                            webpg.jq("#inline-options-link").hide();
                        } else {
                            webpg.preferences.decorate_inline.set(true);
                            status = _("Enabled");
                            this.checked = true;
                            webpg.jq("#inline-options-link").show();
                        }
                        webpg.jq(this).button('option', 'label', status);
                        webpg.jq(this).button('refresh');
                    }
                );

                webpg.jq("#inline-options-link").click(function() {
                    if (webpg.utils.detectedBrowser.vendor == 'mozilla') {
                        webpg.jq("#options-dialog-content").html(
                            "<span class='webpg-options-text'>" + _("Inline formatting mode") + "&nbsp;&nbsp;</span>" +
                            "<div style='display:inline-block;' id='inline-format-options'>" +
                            "<input type='radio' name='inline-format-radio' id='window' /><label for='window'>" + _("Window") + "</label>" +
                            "<input type='radio' name='inline-format-radio' id='icon' /><label for='icon'>" + _("Icon") + "</label>" +
                            "</div>" +
                            "<a id='inline-sample-link' style='padding-top:12px' class='webpg-options-text options-link'>" + _("Sample") + "</a>" +
                            "<img id='inline-sample-image' style='max-width:610px;' src='" + webpg.utils.resourcePath + "skin/images/examples/inline-formatting-" +
                                webpg.preferences.decorate_inline.mode() + ".png'/><br/><br/>" +
                            "<span class='webpg-options-text'>" + _("WebPG Toolbar") + "&nbsp;&nbsp;</span>" +
                            "<div style='display:inline-block;' id='toolbar-format-options'>" +
                            "<input type='checkbox' name='toolbar-check' id='toolbar-check' /><label for='toolbar-check'></label>" +
                            "</div>" +
                            "<a id='toolbar-sample-link' style='padding-top:12px' class='webpg-options-text options-link'>" + _("Sample") + "</a><br/><br/>" +
                            "<div id='toolbar-sample-textarea'><img id='toolbar-sample-image' style='max-width:610px;' src='" + webpg.utils.resourcePath + "skin/images/examples/toolbar-sample.png'/></div>"
                        );
                        webpg.jq("#inline-sample-link").click(function(e) {
                            webpg.jq("#inline-sample-image").toggle("slide");
                        });
                        webpg.jq("#toolbar-sample-link").click(function(e) {
                            webpg.jq("#toolbar-sample-textarea").toggle("slide");
                        });
                        if (webpg.preferences.render_toolbar.get() == "false")
                            webpg.jq("#toolbar-sample-link").hide();
                    } else {
                        webpg.jq("#options-dialog-content").html(
                            "<span class='webpg-options-text'>" + _("Inline formatting mode") + "&nbsp;&nbsp;</span>" +
                            "<div style='display:inline-block;' id='inline-format-options'>" +
                            "<input type='radio' name='inline-format-radio' id='window' /><label for='window'>" + _("Window") + "</label>" +
                            "<input type='radio' name='inline-format-radio' id='icon' /><label for='icon'>" + _("Icon") + "</label>" +
                            "</div>" +
                            "<a id='inline-sample-link' class='webpg-options-text options-link'>" + _("Sample") + "</a>" +
                            "<pre id='inline-options-pgp-test'>-----BEGIN PGP MESSAGE-----\n" +
                            "Version: GnuPG v1.4.11 (GNU/Linux)\n\n"+
                            "jA0EAwMCL/ruujWlHoVgyS7nibjGsDtEt9QcaHAmknBXnk9yjrh42ug0SxCD/tEO\n" +
                            "ztexzAlHOvxqca3GWTYC\n" +
                            "=HMC5\n" +
                            "-----END PGP MESSAGE-----</pre><br/><br/>" +
                            "<span class='webpg-options-text'>" + _("WebPG Toolbar") + "&nbsp;&nbsp;</span>" +
                            "<div style='display:inline-block;' id='toolbar-format-options'>" +
                            "<input type='checkbox' name='toolbar-check' id='toolbar-check' /><label for='toolbar-check'></label>" +
                            "</div>" +
                            "<a id='toolbar-sample-link' style='padding-top:12px' class='webpg-options-text options-link'>" + _("Sample") + "</a>" +
                            "<div id='toolbar-sample-textarea'></div>"
                            
                        );
                        webpg.jq("#inline-sample-link").click(function(e) {
                            webpg.jq("#inline-options-pgp-test").toggle("slide");
                        });
                        webpg.jq("#toolbar-sample-link").click(function(e) {
                            webpg.jq("#toolbar-sample-textarea").html("<textarea style='width:100%;height:50%;'></textarea>").toggle("slide");
                            webpg.inline.render_toolbar = (webpg.preferences.render_toolbar.get() === "true");
                            webpg.inline.PGPDataSearch(document, false, false);
                        });
                    }
                    webpg.jq("#inline-format-options").buttonset()
                        .find("#" + webpg.preferences.decorate_inline.mode()).attr({"checked": "checked"})
                        .parent().buttonset("refresh").click(function(e) {
                        if (e.target.type == "radio") {
                            webpg.preferences.decorate_inline.mode(e.target.id);
                            if (webpg.utils.detectedBrowser.vendor == 'mozilla') {
                                webpg.jq("#inline-sample-image")[0].src = webpg.utils.resourcePath +
                                    "skin/images/examples/inline-formatting-" +
                                    webpg.preferences.decorate_inline.mode() +
                                    ".png";
                            } else {
                                webpg.inline.mode = e.target.id;
                                webpg.jq("#inline-options-pgp-test")[0].innerHTML = webpg.jq("#inline-options-pgp-test").text();
                            }
                            webpg.inline.PGPDataSearch(document, false, false);
                        }
                    });
                    webpg.jq("#toolbar-check").button({
                            'label': (webpg.preferences.render_toolbar.get() == "true") ? _("Enabled") : _("Disabled")
                    }).click(function(e) {
                        webpg.preferences.render_toolbar.set((this.checked));
                        webpg.inline.render_toolbar = (this.checked);
                        var status = (this.checked) ? _("Enabled") : _("Disabled");
                        webpg.jq(this).button('option', 'label', status);
                        webpg.jq(this).button('refresh');
                        if (this.checked) {
                            if (webpg.utils.detectedBrowser.vendor == 'mozilla')
                                webpg.jq("#toolbar-sample-link").show();
                            else
                                webpg.inline.PGPDataSearch(document, false, false);
                        } else {
                            if (webpg.utils.detectedBrowser.vendor == 'mozilla')
                                webpg.jq("#toolbar-sample-link").hide();
                            webpg.jq("#toolbar-sample-textarea").hide();
                        }
                    });

                    if (webpg.preferences.render_toolbar.get() == "true")
                        webpg.jq("#toolbar-check").attr({'checked': 'checked'}).button("refresh");

                    webpg.jq("#options-dialog").attr("title", _("Inline Options"));

                    webpg.jq("#options-dialog").dialog({
                        'resizable': true,
                        'height': 420,
                        'width': 630,
                        'modal': true,
                        'position': "top",
                        'buttons': [
                        {
                            'text': _("Close"),
                            'click': function() {
                                webpg.jq("#options-dialog").dialog("close");
                                webpg.jq("#options-dialog").dialog("destroy");
                                webpg.jq("#options-dialog").hide();
                            }
                        }
                    ]}).parent().animate({"top": window.scrollY}, 1, function() {
                        document.activeElement.blur();
                        webpg.jq(this).animate({"top": 20}, 1);
                        webpg.inline.mode = webpg.preferences.decorate_inline.mode();
                        webpg.inline.PGPDataSearch(document, false, false);
                    });
                });

                webpg.jq('#enable-encrypt-to-self-check').button({
                    'label': (webpg.preferences.default_key.get() === "") ?
                             _("No default key set") :
                                 (webpg.preferences.encrypt_to_self.get()) ?
                                 _('Enabled') : _('Disabled')
                    }).click(function(e) {
                        var status;
                        if (webpg.preferences.encrypt_to_self.get()) {
                            webpg.preferences.encrypt_to_self.set(false);
                            this.checked = false;
                            status = _('Disabled');
                        } else {
                            webpg.preferences.encrypt_to_self.set(true);
                            this.checked = true;
                            status = _('Enabled');
                        }
                        webpg.jq(this).button('option', 'label', status);
                        webpg.jq(this).button('refresh');
                    }
                );

                webpg.jq('#enable-gmail-integration-check').button({
                    'label': (webpg.preferences.gmail_integration.get() == 'true') ? _('Enabled') : _('Disabled')
                    }).click(function(e) {
                        if (webpg.preferences.gmail_integration.get() === null ||
                            webpg.preferences.gmail_integration.get() === 'false') {
                            alert(_("WebPG GMAIL integration is EXPERIMENTAL") + "; " + _("use at your own risk"));
                        }

                        (webpg.preferences.gmail_integration.get() == 'true') ?
                            webpg.preferences.gmail_integration.set(false)
                            : webpg.preferences.gmail_integration.set(true);
                        status = (webpg.preferences.gmail_integration.get() == 'true') ? _('Enabled') : _('Disabled');
                        if (webpg.preferences.gmail_integration.get() == 'true') {
                            webpg.jq("#gmail-action-sign").show();
                            //webpg.jq("#gmail-linked-identities").show()
                        } else {
                            webpg.jq("#gmail-action-sign").hide();
                            webpg.jq("#gmail-linked-identities").hide();
                        }
                        webpg.jq(this).button('option', 'label', status);
                        this.checked = (webpg.preferences.gmail_integration.get() == 'true');
                        webpg.jq(this).button('refresh');
                    }
                );

                webpg.jq('#gmail-action-sign-check').button({
                    'label': (webpg.preferences.sign_gmail.get() == 'true') ? _('Enabled') : _('Disabled')
                    }).click(function(e) {
                        (webpg.preferences.sign_gmail.get() == 'true') ?
                            webpg.preferences.sign_gmail.set(false)
                            : webpg.preferences.sign_gmail.set(true);
                        status = (webpg.preferences.sign_gmail.get() == 'true') ? _('Enabled') : _('Disabled');
                        webpg.jq(this).button('option', 'label', status);
                        this.checked = (webpg.preferences.sign_gmail.get() == 'true');
                        webpg.jq(this).button('refresh');
                    }
                );

                for (var ident in webpg.xoauth2.comp_data) {
                    var id = webpg.xoauth2.comp_data[ident];
                    var identli = "<li><img class='ident-photo' src='" + id.picture + "'/>" + ident + "<a id='" + ident + "' style='padding-left:20px;text-decoration:underline;cursor:pointer;font-size: 80.5%;text-transform:lowercase;'>[" + _("delete") + "]</a></li>";
                    webpg.jq("#gmail-linked-identities").find(".ident-list").append(identli);
                }

                // Hide the gmail linked identies feature (not yet implemented)
                webpg.jq("#gmail-linked-identities").hide();

                webpg.jq("#gmail-linked-identities").find(".ident-list").find("a").click(function() {
                    if (webpg.xoauth2.comp_data.hasOwnProperty(this.id)) {
                        delete webpg.xoauth2.comp_data[this.id];
                        webpg.preferences.xoauth2_data.set(webpg.xoauth2.comp_data);
                        console.log(webpg.xoauth2.comp_data);
                        this.parentElement.remove();
                    }
                });
                

                webpg.jq("#gnupg-path-save").button().click(function(e) {
                    webpg.preferences.gnupghome.set(webpg.jq("#gnupg-path-input")[0].value);
                    webpg.jq(this).hide();
                });

                webpg.jq("#gnupg-path-input").each(function() {
                    // Save current value of element
                    webpg.jq(this).data('oldVal', webpg.jq(this).val());

                    // Look for changes in the value
                    webpg.jq(this).bind("change propertychange keyup input paste", function(event) {
                        // If value has changed...
                        if (webpg.jq(this).data('oldVal') != webpg.jq(this).val()) {
                            // Updated stored value
                            webpg.jq(this).data('oldVal', webpg.jq(this).val());

                            // Show save dialog
                            if (webpg.jq(this).val() != webpg.preferences.gnupghome.get())
                                webpg.jq("#gnupg-path-save").show();
                            else
                                webpg.jq("#gnupg-path-save").hide();
                        }
                    });
                })[0].value = webpg.preferences.gnupghome.get();

                webpg.jq("#gnupg-path-input")[0].dir = "ltr";

                webpg.jq("#gnupg-binary-save").button().click(function(e) {
                    webpg.preferences.gnupgbin.set(webpg.jq("#gnupg-binary-input")[0].value);
                    window.top.document.location.reload();
                    webpg.jq(this).hide();
                });

                webpg.jq("#gnupg-binary-input").each(function() {
                    // Save current value of element
                    webpg.jq(this).data('oldVal', webpg.jq(this).val());

                    // Look for changes in the value
                    webpg.jq(this).bind("change propertychange keyup input paste", function(event) {
                        // If value has changed...
                        if (webpg.jq(this).data('oldVal') != webpg.jq(this).val()) {
                            // Updated stored value
                            webpg.jq(this).data('oldVal', webpg.jq(this).val());

                            // Show save dialog
                            if (webpg.jq(this).val() != webpg.preferences.gnupgbin.get())
                                webpg.jq("#gnupg-binary-save").show();
                            else
                                webpg.jq("#gnupg-binary-save").hide();
                        }
                    });
                })[0].value = webpg.preferences.gnupgbin.get();

                webpg.jq("#gnupg-binary-input")[0].dir = "ltr";

                webpg.jq("#gpgconf-binary-save").button().click(function(e) {
                    webpg.preferences.gpgconf.set(webpg.jq("#gpgconf-binary-input")[0].value);
                    window.top.document.location.reload();
                    webpg.jq(this).hide();
                });

                webpg.jq("#gpgconf-binary-input").each(function() {
                    // Save current value of element
                    webpg.jq(this).data('oldVal', webpg.jq(this).val());

                    // Look for changes in the value
                    webpg.jq(this).bind("change propertychange keyup input paste", function(event) {
                        // If value has changed...
                        if (webpg.jq(this).data('oldVal') != webpg.jq(this).val()) {
                            // Updated stored value
                            webpg.jq(this).data('oldVal', webpg.jq(this).val());

                            // Show save dialog
                            if (webpg.jq(this).val() != webpg.preferences.gpgconf.get())
                                webpg.jq("#gpgconf-binary-save").show();
                            else
                                webpg.jq("#gpgconf-binary-save").hide();
                        }
                    });
                })[0].value = webpg.preferences.gpgconf.get();

                webpg.jq("#gpgconf-binary-input")[0].dir = "ltr";

                webpg.jq("#gnupg-keyserver-save").button().click(function(e) {
                    if (!webpg.plugin.webpg_status.gpgconf_detected)    
                        return false;
                    webpg.plugin.gpgSetPreference("keyserver", webpg.jq("#gnupg-keyserver-input")[0].value);
                    webpg.jq(this).hide();
                });

                webpg.jq("#gnupg-keyserver-input").each(function() {
                    // Save current value of element
                    webpg.jq(this).data('oldVal', webpg.jq(this).val());

                    // Look for changes in the value
                    webpg.jq(this).bind("change propertychange keyup input paste", function(event) {
                        // If value has changed...
                        if (webpg.jq(this).data('oldVal') != webpg.jq(this).val()) {
                            // Updated stored value
                            webpg.jq(this).data('oldVal', webpg.jq(this).val());

                            // Show save dialog
                            if (webpg.jq(this).val() != webpg.plugin.gpgGetPreference("keyserver").value)
                                webpg.jq("#gnupg-keyserver-save").show();
                            else
                                webpg.jq("#gnupg-keyserver-save").hide();
                        }
                    });
                })[0].value = webpg.plugin.gpgGetPreference("keyserver").value;

                webpg.jq("#gnupg-keyserver-input")[0].dir = "ltr";
                
                // Site exceptions stuff
                
                webpg.jq("#site-whitelist-list").html(
                    '<option>' + webpg.preferences.site_exceptions.get().whitelist.join('</option><option>') + '</option>'
                );
                webpg.jq("#site-blacklist-list").html(
                    '<option>' + webpg.preferences.site_exceptions.get().blacklist.join('</option><option>') + '</option>'
                );
                
                webpg.jq("input[name=site-filtering-mode]")
                    .filter('[value=' + webpg.preferences.site_exceptions.mode() + ']')
                    .attr('checked', 'checked');
                
                webpg.jq("input[name=site-filtering-mode]").change(function() {
                    var filter_mode = webpg.jq("input[name=site-filtering-mode]:checked").val();
                    webpg.preferences.site_exceptions.mode(filter_mode);
                });
                
                webpg.jq("#site-whitelist-add").click(function() {
                    var site_input = webpg.jq(this).siblings('input[type=text]');
                    if (site_input.val() != "") {
                        // Validate before adding
						var site_URI = new URI(site_input.val());
                        if (site_URI.scheme().length == 0)
                            site_URI.scheme('http');
                        
                        // At least path (eg google.com) and http(s) is expected of the URI
                        if (site_URI.scheme() != "http" && site_URI.scheme() != "https")
                        {
                            alert('Invalid URI scheme');
                            return;
                        }
                        
                        if (site_URI.path().length == 0)
                        {
                            alert('Invalid URI');
                            return;
                        }
                        
                        webpg.preferences.site_exceptions.add('whitelist', site_URI.toString());
                        var site_exceptions = webpg.preferences.site_exceptions.get();
                        webpg.jq('#site-whitelist-list').html('<option>' + site_exceptions.whitelist.join('</option><option>') + '</option>');
                    }
					site_input.val('');
					site_input.focus();
                });
                webpg.jq("#site-blacklist-add").click(function() {
                    var site_input = webpg.jq(this).siblings('input[type=text]');
                    if (site_input.val() != "") {
                        webpg.preferences.site_exceptions.add('blacklist', site_input.val());
                        var site_exceptions = webpg.preferences.site_exceptions.get();
                        webpg.jq('#site-blacklist-list').html('<option>' + site_exceptions.blacklist.join('</option><option>') + '</option>');
                    }
					site_input.val('');
					site_input.focus();
                });
				
                webpg.jq("#site-whitelist-remove").click(function() {
                    var sites = webpg.jq('#site-whitelist-list').val();
                    webpg.jq.each(sites, function(index, site) {
						webpg.preferences.site_exceptions.remove('whitelist', site);
                        var site_exceptions = webpg.preferences.site_exceptions.get();
                        webpg.jq('#site-whitelist-list').html('<option>' + site_exceptions.whitelist.join('</option><option>') + '</option>');
					});
                });
                webpg.jq("#site-blacklist-remove").click(function() {
                    var sites = webpg.jq('#site-blacklist-list').val();
                    webpg.jq.each(sites, function(index, site) {
						webpg.preferences.site_exceptions.remove('blacklist', site);
                        var site_exceptions = webpg.preferences.site_exceptions.get();
                        webpg.jq('#site-blacklist-list').html('<option>' + site_exceptions.blacklist.join('</option><option>') + '</option>');
					});
                });
            }
        }

        if (webpg.utils.detectedBrowser.vendor == "mozilla")
            webpg.jq('#window_functions').hide();

        webpg.jq('#close').button().button("option", "label", _("Finished"))
            .click(function(e) { window.top.close(); });

        webpg.utils.extension.version(function(version) {
            webpg.jq("#webpg-info-version-string").text(
                _("Version") + ": " + webpg.utils.escape(version)
            );
        });
    }
};
webpg.jq(function() {
    var browserWindow = null;
    if (webpg.utils.detectedBrowser['vendor'] == 'mozilla')
      browserWindow = webpg.utils.mozilla.getChromeWindow();
    webpg.options.init(browserWindow);
});
/* ]]> */
