$.namespace('SCWeb.ui');


SCWeb.ui.UserPanel = {
    
    /*!
     * Initialize user panel.
     * @param {Object} params Parameters for panel initialization.
     * There are required parameters:
     * - sc_addr - sc-addr of user
     * - is_authenticated - flag that have True value, in case when user is authenticated
     * - current_lang - sc-addr of used natural language
     */
    init: function(params, callback) {
        
        this.is_authenticated = params.is_authenticated;
        this.user_sc_addr = params.sc_addr;
        this.lang_mode_sc_addr = params.current_lang;
        this.default_ext_lang_sc_addr = params.default_ext_lang
        
        if (this.is_authenticated) {
            $('#auth-user-name').attr('sc_addr', this.user_sc_addr).text(this.user_sc_addr);
            $('#auth-user-lang').attr('sc_addr', this.lang_mode_sc_addr).text(this.lang_mode_sc_addr);
            $('#auth-user-ext-lang').attr('sc_addr', this.default_ext_lang_sc_addr).text(this.default_ext_lang_sc_addr);
        }
        
        // listen translation events
		SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation);
		SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
			$('#auth-user-panel [sc_addr]').each(function(index, element) {
				objects.push($(element).attr('sc_addr'));
			});
		});
        
        SCWeb.ui.Utils.bindArgumentsSelector("auth-user-panel", "[sc_addr]");
        
        callback();
    },
    
    // ---------- Translation listener interface ------------
    updateTranslation: function(namesMap) {
        // apply translation
        $('#auth-user-panel [sc_addr]').each(function(index, element) {
            var addr = $(element).attr('sc_addr');
            if(namesMap[addr]) {
                $(element).text(namesMap[addr].replace('user::', '').replace('session::', ''));
            }
        });
        
    },


};


SCWeb.ui.ArgumentsPanel = {
    _container : '#arguments_buttons',

    init : function(callback) {

      	var self = this;
		// listen events from arguments
		SCWeb.core.EventManager.subscribe("arguments/add", this, this.onArgumentAppended);
		SCWeb.core.EventManager.subscribe("arguments/remove", this, this.onArgumentRemoved);
		SCWeb.core.EventManager.subscribe("arguments/clear", this, this.onArgumentsCleared);
		
        
        // listen events from translation
		SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation);
        SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
			var items = self.getObjectsToTranslate();
			for (var i in items) {
				objects.push(items[i]);
			}
		});
		

        $('#arguments_clear_button').click(function() {

            SCWeb.core.Arguments.clear();
        });

        $(document).on("click", ".arguments_item", function(event) {

            var idx = $(this).attr('arg_idx');
            SCWeb.core.Arguments.removeArgumentByIndex(parseInt(idx));
        });
        
        callback();
    },

    // ------- Arguments listener interface -----------
    onArgumentAppended : function(argument, idx) {

        var idx_str = idx.toString();
        var self = this;

        // translate added command
        SCWeb.core.Translation
                .translate(
                        [ argument ],
                        function(namesMap) {

                            var value = argument;
                            if (namesMap[argument]) {
                                value = namesMap[argument];
                            }

                            var new_button = '<button class="btn btn-primary arguments_item" sc_addr="'
                                    + argument
                                    + '" arg_idx="'
                                    + idx_str
                                    + '" id="argument_'
                                    + idx_str
                                    + '">'
                                    + value + '</button>';
                            $(self._container).append(new_button);
                        });

    },

    onArgumentRemoved : function(argument, idx) {

        $('#argument_' + idx.toString()).remove();
        // update indicies
        $(this._container + ' [arg_idx]').each(function(index, element) {

            var v = parseInt($(this).attr('arg_idx'));

            if (v > idx) {
                v = v - 1;
                $(this).attr('arg_idx', v.toString());
                $(this).attr('id', 'argument_' + v.toString());
            }
        });
    },

    onArgumentsCleared : function() {

        $(this._container).empty();
    },

    // ------- Translation listener interface ---------
    updateTranslation : function(namesMap) {

        // apply translation
        $('#arguments_buttons [sc_addr]').each(function(index, element) {

            var addr = $(element).attr('sc_addr');
            if (namesMap[addr]) {
                $(element).text(namesMap[addr]);
            }
        });
    },

    getObjectsToTranslate : function() {

        return SCWeb.core.Arguments._arguments;
    }

};


SCWeb.ui.TaskPanel = {
    _container: '#task_panel',
    _text_container: '#task_num',
    _task_num: 0,
    
    init: function(callback) {
        
        SCWeb.core.Server.appendListener(this);
        
        if (callback)
            callback();
    },
    
    /*!
     * Updates task panel view
     */
    updatePanel: function() {
        if (this._task_num == 0) {
            $(this._container).removeClass('active');
        }else{
            $(this._container).addClass('active');
        }
        var text = ''
        if (this._task_num > 0)
            text = this._task_num.toString();
        $(this._text_container).text(text);
    },
    
    // ------- Server listener --------
    taskStarted: function() {
        this._task_num++;
        this.updatePanel();
    },
    
    taskFinished: function() {
        this._task_num--;
        this.updatePanel();
    }
};


SCWeb.ui.WindowManager = {
    
    // dictionary that contains information about windows corresponding to history items
    windows: {},
    window_count: 0,
    window_active_formats: {},
    sandboxes: {},
    active_window_addr: null,
    active_history_addr: null,
    
    
    // function to create hash from question addr and format addr
    hash_addr: function(question_addr, fmt_addr) {
		return question_addr + ':' + fmt_addr;
	},
    
    init: function(params, callback) {
        
        this.ext_langs = params.external_languages;
        
        this.history_tabs_id = '#history-items';
        this.history_tabs = $(this.history_tabs_id);
        
        this.window_container_id = '#window-container';
        this.window_container = $(this.window_container_id);
        
        var self = this;
        
        // external language
        var ext_langs_items = '';
        for (idx in this.ext_langs) {
			var addr = this.ext_langs[idx];
			ext_langs_items += '<li><a href="#" sc_addr="' + addr + '">' + addr + '</a></li>';
		}
		$('#history-item-langs').html(ext_langs_items).find('[sc_addr]').click(function(event) {
			var question_addr = self.active_history_addr;
			var lang_addr = $(this).attr('sc_addr');
			var fmt_addr = SCWeb.core.ComponentManager.getPrimaryFormatForExtLang(lang_addr);
			
			if (fmt_addr) {
				self.window_active_formats[question_addr] = fmt_addr;
				self.requestTranslation(question_addr, fmt_addr);
			} else {
				// TODO: process error
			}
			
		});
        
        // listen translation events
		SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation);
		SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
			$(this.history_tabs_id + ' [sc_addr], #history-item-langs [sc_addr]').each(function(index, element) {
				objects.push($(element).attr('sc_addr'));
			});
		});
        
        callback();
    },
    
    // ----------- History ------------
    /**
     * Append new tab into history
     * @param {String} question_addr sc-addr of item to append into history
     */
    appendHistoryItem: function(question_addr) {
        
        // @todo check if tab exist        
        var tab_html = '<li class="list-group-item history-item" sc_addr="' + question_addr + '">' +
							'<h5 class="history-item-name list-group-item-heading">' + question_addr + '</h5>' +
							'<p class="list-group-item-text"> description </p>' +
						'</li>';

        this.history_tabs.prepend(tab_html);
                
        // get translation and create window
        var ext_lang_addr = SCWeb.core.Main.getDefaultExternalLang();
        var fmt_addr = SCWeb.core.ComponentManager.getPrimaryFormatForExtLang(ext_lang_addr);
		if (fmt_addr) {
			this.requestTranslation(question_addr, fmt_addr);
		} else
		{
			// error
		}
        
        this.setHistoryItemActive(question_addr);
        
        // setup input handlers
        var self = this;
        this.history_tabs.find("[sc_addr]").click(function(event) {
			var question_addr = $(this).attr('sc_addr');
			self.setHistoryItemActive(question_addr);
			self.setWindowActive(self.windows[self.hash_addr(question_addr, self.window_active_formats[question_addr])]);
			
		});
    },
    
    /**
     * Removes specified history item
     * @param {String} addr sc-addr of item to remove from history
     */
    removeHistoryItem: function(addr) {
        this.history_tabs.find("[sc_addr='" + addr + "']").remove();
    },
    
    /**
     * Set new active history item
     * @param {String} addr sc-addr of history item
     */
    setHistoryItemActive: function(addr) {
		if (this.active_history_addr) {
			this.history_tabs.find("[sc_addr='" + this.active_history_addr + "']").removeClass('active').find('.histoy-item-btn').addClass('hidden');
		}
		
		this.active_history_addr = addr;
		this.history_tabs.find("[sc_addr='" + this.active_history_addr + "']").addClass('active').find('.histoy-item-btn').removeClass('hidden');
	},
	
	/**
	 * Get translation of question to external language and append new window for it
	 * @param {String} question_addr sc-addr of question to translate
	 * @param {String} fmt_addt sc-addr of output format
	 */
	requestTranslation: function(question_addr, fmt_addr) {
		var self = this;
		var window = self.windows[self.hash_addr(question_addr, fmt_addr)];
		if (window) {
			self.setWindowActive(window);
		} else {
			
			SCWeb.ui.Locker.show();
			// scroll window to the top
			$("html, body").animate({ scrollTop: 0}, "slow");
			SCWeb.core.Server.getAnswerTranslated(question_addr, fmt_addr, function(data) {
				self.appendWindow(data.link, fmt_addr);
				self.window_active_formats[question_addr] = fmt_addr;
				self.windows[self.hash_addr(question_addr, fmt_addr)] = data.link;
				SCWeb.ui.Locker.hide();
			});
		}
	},
    
    // ------------ Windows ------------
    /**
     * Append new window
     * @param {String} addr sc-addr of question
     * @param {String} fmt_addr sc-addr of window format
     */
    appendWindow: function(addr, fmt_addr) {
        /*<div class="panel panel-primary">
            <div class="panel-heading">Panel heading without title</div>
            <div class="panel-body">
                Panel content
            </div>
        </div>*/
        
        var window_id = 'window_' + addr;
        var window_html =   '<div class="panel panel-default" sc_addr="' + addr + '" sc-addr-fmt="' + fmt_addr + '">' +
                                /*'<div class="panel-heading">' + addr + '</div>' +*/
                                '<div class="panel-body" id="' + window_id + '"></div>'
                            '</div>';
        this.window_container.prepend(window_html);
        
        var sandbox = SCWeb.core.ComponentManager.createWindowSandbox(fmt_addr, addr, window_id);
        this.sandboxes[addr] = sandbox;
        
        SCWeb.core.Server.getLinkContent(addr, 
			function(data) {
				sandbox.onDataAppend(data);
			},
			function() { // error
			}
		);
		
		this.setWindowActive(addr);
    },
    
    /**
     * Remove specified window
     * @param {String} addr sc-addr of window to remove
     */
    removeWindow: function(addr) {
        this.window_container.find("[sc_addr='" + addr + "']").remove();
    },
    
    /**
     * Makes window with specified addr active
     * @param {String} addr sc-addr of window to make active
     */
    setWindowActive: function(addr) {
		if (this.active_window_addr) {
			this.window_container.find("[sc_addr='" + this.active_window_addr + "']").addClass('hidden');
		}
		
		this.active_window_addr = addr;
		this.window_container.find("[sc_addr='" + this.active_window_addr + "']").removeClass('hidden');		
	},

	// ---------- Translation listener interface ------------
    updateTranslation: function(namesMap) {
        // apply translation
        $(this.history_tabs_id + '[sc_addr] , #history-item-langs [sc_addr]').each(function(index, element) {
            var addr = $(element).attr('sc_addr');
            if(namesMap[addr]) {
                $(element).text(namesMap[addr]);
            }
        });
        
    },
};


SCWeb.ui.LanguagePanel = {
	
	/*!
     * Initialize settings panel.
     * @param {Object} params Parameters for panel initialization.
     * There are required parameters:
     * - languages - list of available natural languages
     */
    init: function(params, callback) {
		this.languages = params.languages;
		
		var html = '';
		for (i in this.languages) {
			var addr = this.languages[i];
			
			html += '<option sc_addr="' + addr + '">' + addr + '</option>';
		}
		
		// append languages to select
		$('#language-select').html(html)
			.val(params.user.current_lang)
			.change(function() {
				SCWeb.ui.Locker.show();
				var addr = $('#language-select option:selected').attr("sc_addr");
				SCWeb.core.Translation.setLanguage(addr, function() {
					SCWeb.ui.Locker.hide();
				});
			});
		
		// listen translation events
		SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation);
		SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
			$('#language-select [sc_addr]').each(function(index, element) {
				objects.push($(element).attr('sc_addr'));
			});
		});
		
		callback();
	},
	
	
	// ---------- Translation listener interface ------------
    updateTranslation: function(namesMap) {
        // apply translation
        $('#language-select [sc_addr]').each(function(index, element) {
            var addr = $(element).attr('sc_addr');
            if(namesMap[addr]) {
                $(element).text(namesMap[addr].replace('user::', '').replace('session::', ''));
            }
        });
        
    },
	
};


SCWeb.ui.Menu = {
    _items: null,

    /*!
     * Initialize menu in user interface
     * @param {Object} params Parameters for menu initialization.
     * There are required parameters:
     * - menu_container_id - id of dom element that will contains menu items
     * - menu_commands - object, that represent menu command hierachy (in format returned from server)
     */
    init: function(params, callback) {
        var self = this;
        
        this.menu_container_id = '#' + params.menu_container_id;
        
        // register for translation updates
        SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
			var items = self.getObjectsToTranslate();
			for (var i in items) {
				objects.push(items[i]);
			}
		});
		SCWeb.core.EventManager.subscribe("translation/update", this, function(names) {
			self.updateTranslation(names);
		});
        
        this._build(params.menu_commands);
        callback();
    },

    _build: function(menuData) {

        this._items = [];

        var menuHtml = '<ul class="nav navbar-nav">';

        //TODO: change to children, remove intermediate 'childs'
        if(menuData.hasOwnProperty('childs')) {
            var id, subMenu;
            for(i in menuData.childs) {
                subMenu = menuData.childs[i];
                menuHtml += this._parseMenuItem(subMenu);
            }
        }

        menuHtml += '</ul>';

        $(this.menu_container_id).append(menuHtml);

        this._registerMenuHandler();
    },

    _parseMenuItem: function(item) {

        this._items.push(item.id);

        var itemHtml = '';
        if(item.cmd_type == 'cmd_noatom') {
            itemHtml = '<li class="dropdown"><a sc_addr="' + item.id + '" id="' + item.id + '" class="menu_item ' + item.cmd_type + ' dropdown-toggle" data-toggle="dropdown" href="#" ><span clas="text">' + item.id + '</span><b class="caret"></b></a>';
            
        } else {
            itemHtml = '<li><a id="' + item.id + '"sc_addr="' + item.id + '" class="menu_item ' + item.cmd_type + '" >' + item.id + '</a>';
        }

        if(item.hasOwnProperty('childs')) {
            itemHtml += '<ul class="dropdown-menu">';
            var id;
            var subMenu;
            var i;
            for(i = 0; i < item.childs.length; i++) {
                subMenu = item.childs[i];
                itemHtml += this._parseMenuItem(subMenu);
            }
            itemHtml += '</ul>';
        }
        return itemHtml + '</li>';
    },

    _registerMenuHandler: function() {
        
        SCWeb.ui.Utils.bindArgumentsSelector("menu_container", "[sc_addr]");
        
        $('.menu_item').click(function() {
            
            var sc_addr = $(this).attr('sc_addr');
            if ($(this).hasClass('cmd_atom')) {
				SCWeb.core.Main.doCommand(sc_addr, SCWeb.core.Arguments._arguments);
			}
        });
    },
    
    // ---------- Translation listener interface ------------
    updateTranslation: function(namesMap) {
        // apply translation
        $(this.menu_container_id + ' [sc_addr]').each(function(index, element) {
            var addr = $(element).attr('sc_addr');
            if(namesMap[addr]) {
                $(element).text(namesMap[addr]);
            }
        });
        
    },
    
    /**
     * @return Returns list obj sc-elements that need to be translated
     */
    getObjectsToTranslate: function() {
        return this._items;
    }
};


SCWeb.ui.Locker = {
    _locker: null,

    show: function() {
        $('#sc-ui-locker').addClass('shown');
    },

    hide: function() {
        $('#sc-ui-locker').removeClass('shown');
    }
};


SCWeb.ui.Utils = {
    /**
     * Bind default handler for arguments selection to specified elements
     * @param {String} container_id Id of elements container
     * @param {String} selector jQuery selector for elements
     */
    bindArgumentsSelector: function(container_id, selector) {

        $("#" + container_id).on("mousedown", selector, function(e) {
			
			if (e.which === 1) {
				
				var self = this;
				clearTimeout(this.downTimer);
				
				this.downTimer = setTimeout(function() {
					SCWeb.core.Arguments.appendArgument($(self).attr('sc_addr'));
					self.done = true;
					clearTimeout(this.downTimer);
				}, 1000);
			}
            
        }).on("mouseup mouseleave", selector, function(e) {
            clearTimeout(this.downTimer);
            if (this.done) {
                delete this.done;
                e.stopPropagation();
            }
        });
        
    },
    
};


$.namespace('SCWeb.core');


/**
 * Create new instance of component sandbox.
 * @param {String} container Id of dom object, that will contain component
 * @param {String} link_addr sc-addr of link, that edit or viewed with sandbox
 */
SCWeb.core.ComponentSandbox = function(container, link_addr) {
    this.container = container;
    this.link_addr = link_addr;
    
    this.eventGetObjectsToTranslate = null;
    this.eventApplyTranslation = null;
    this.eventArgumentsUpdate = null;
    this.eventWindowActiveChanged = null;
    this.eventDataAppend = null;
    
    this.listeners = [];
    
    var self = this;
	this.listeners = [];
    
    // listen arguments
    this.listeners.push(SCWeb.core.EventManager.subscribe("arguments/add", this, this.onArgumentAppended));
	this.listeners.push(SCWeb.core.EventManager.subscribe("arguments/remove", this, this.onArgumentRemoved));
    this.listeners.push(SCWeb.core.EventManager.subscribe("arguments/clear", this, this.onArgumentCleared));
	
	// listen translation
	this.listeners.push(SCWeb.core.EventManager.subscribe("translation/update", this, this.updateTranslation));
	this.listeners.push(SCWeb.core.EventManager.subscribe("translation/get", this, function(objects) {
		var items = self.getObjectsToTranslate();
		for (var i in items) {
			objects.push(items[i]);
		}
	}));
};

SCWeb.core.ComponentSandbox.prototype = {
    constructor: SCWeb.core.ComponentSandbox
};

// ------------------ Core functions --------------------------
/**
 * Destroys component sandbox
 */
SCWeb.core.ComponentSandbox.prototype.destroy = function() {
	for (var l in this.listeners) {
		SCWeb.core.EventManager.unsubscribe(this.listeners[l]);
	}
};


// ------------------ Functions to call from component --------
SCWeb.core.ComponentSandbox.prototype.getIdentifiers = function(addr_list, callback) {
	SCWeb.core.Server.resolveIdentifiers(addr_list, callback);
};

SCWeb.core.ComponentSandbox.prototype.getLinkContent = function(addr, callback_success, callback_error) {
	SCWeb.core.Server.getLinkContent(addr, callback_success, callback_error);
};

/**
 * Create viewers for specified sc-links
 * @param {Object} containers_map Map of viewer containers (key: sc-link addr, value: id of container)
 * @param {Function} callback_success Function that calls on success result. It takes one object as parameter. That object 
 * is a dictionary that contains created snadboxes for links sc-addr
 * @param {Function} callback_error Function that calls on error result
 */
SCWeb.core.ComponentSandbox.prototype.createViewersForScLinks = function(containers_map, callback_success, callback_error) {
	var linkAddrs = [];
	for (var addr in containers_map)
			linkAddrs.push(addr);
                
	SCWeb.core.Server.getLinksFormat(linkAddrs,
		function(formats) {
			
			var result = {};
			for (var i = 0; i < linkAddrs.length; i++) {
				var addr = linkAddrs[i];
				var fmt = formats[addr];
				if (fmt) {
					
					sandbox = SCWeb.core.ComponentManager.createWindowSandbox(fmt, addr, containers_map[addr]);
					
					if (sandbox) {
						result[addr] = sandbox;
					}
				}
			}
			
			callback_success(result);
		},
		callback_error
	);
};

// ------ Translation ---------
/**
 * This function returns list of objects, that can be translated.
 * Just for internal usage in core.
 */
SCWeb.core.ComponentSandbox.prototype.getObjectsToTranslate = function() {
    if (this.eventGetObjectsToTranslate)
        return this.eventGetObjectsToTranslate();
        
    return [];
};

/**
 * This function apply translation to component.
 * Just for internal usage in core
 * @param {Object} translation_map Dictionary of translation
 */
SCWeb.core.ComponentSandbox.prototype.updateTranslation = function(translation_map) {
    if (this.eventApplyTranslation)
       this.eventApplyTranslation(translation_map);
};

// ----- Arguments ------
SCWeb.core.ComponentSandbox.prototype._fireArgumentsChanged = function() {
    if (this.eventArgumentsUpdate)
        this.eventArgumentsUpdate(SCWeb.core.Arguments._arguments.slice(0));
};

/**
 * Calls when new argument added
 * @param {String} argument sc-addr of argument
 * @param {Integer} idx Index of argument
 */
SCWeb.core.ComponentSandbox.prototype.onArgumentAppended = function(argument, idx) {
    this._fireArgumentsChanged();
};

/**
 * Calls when new argument removed
 * @param {String} argument sc-addr of argument
 * @param {Integer} idx Index of argument
 */
SCWeb.core.ComponentSandbox.prototype.onArgumentRemoved = function(argument, idx) {
    this._fireArgumentsChanged();
};

/**
 * Calls when arguments list cleared
 */
SCWeb.core.ComponentSandbox.prototype.onArgumentCleared = function() {
    this._fireArgumentsChanged();
};

// --------- Window -----------
SCWeb.core.ComponentSandbox.prototype.onWindowActiveChanged = function(is_active) {
    if (this.eventWindowActiveChanged)
        this.eventWindowActiveChanged(is_active);
};

// --------- Data -------------
SCWeb.core.ComponentSandbox.prototype.onDataAppend = function(data) {
	if (this.eventDataAppend)
		this.eventDataAppend(data);
		
	SCWeb.core.Translation.translate(this.getObjectsToTranslate(), $.proxy(this.updateTranslation, this));
};


SCWeb.core.ErrorCode = {
	Unknown: 0,
	ItemNotFound: 1,
	ItemAlreadyExists: 2
};

SCWeb.core.Debug = {
	
	code_map: {
				0: "Unknown",
				1: "ItemNotFound",
				2: "ItemAlreadyExists"
				},
	
	
	codeToText: function(code) {
		return this.code_map[code];
	},
	
	/**
	 * Function to call, when any error occurs
	 * @param {SCWeb.core.ErrorCode} code Code of error (error type)
	 * @param 
	 */
	error: function(code, message) {
		console.log("Error: " + this.codeToText(code) + ". " + message);
	}
};


/**
 * Object controls list of command parameters.
 * It can fires next events:
 * - "arguments/add" - this event emits on new argument add. Parameters: arg, idx 
 * where:
 * 		- arg - is a sc-addr of object that added as argument;
 * 		- idx - is an index of the argument
 * - "arguments/remove" - this event emits on argument remove. Parameters: arg, idx
 * where:
 * 		- arg - is a sc-addr of object that removed from arguments;
 * 		- idx - is an index of the argument
 * - "arguments/clear" - this event emits on arguments clear (all arguments removed at once)
 */
SCWeb.core.Arguments = {

    _arguments : [],

    /**
     * Append new argument into the end of list
     *
     * @param {String}
     * argument SC-addr of command argument
     * @return Returns index of appended argument
     */
    appendArgument : function(argument) {

        this._arguments.push(argument);

        var idx = this._arguments.length - 1;
        this._fireArgumentAppended(argument, idx);

        return idx;
    },

    /**
     * Removes first occurrence of specified argument
     *
     * @param {String}
     * argument SC-add of argument to remove
     */
    removeArgument : function(argument) {

        var idx = this._arguments.indexOf(argument);

        if (idx >= 0) {
            var arg = this._arguments[idx];
            this._arguments.splice(idx, 1);

            this._fireArgumentAppended(arg, idx);
        }
    },

    /**
     * Remove argument by specified index
     *
     * @param {Number}
     * idx Index of argument to remove
     */
    removeArgumentByIndex : function(idx) {

        if (idx < this._arguments.length) {
            var arg = this._arguments[idx];
            this._arguments.splice(idx, 1);

            this._fireArgumentRemoved(arg, idx);
        }
    },

    /**
     * Clears arguments list
     */
    clear : function() {

        this._arguments = [];
        this._fireArgumentCleared();
    },

    /**
     * Notify listener on argument added
     *
     * @param {String}
     * argument Argument, that was added *
     * @param {Number}
     * Index of added argument
     */
    _fireArgumentAppended : function(argument, idx) {

        SCWeb.core.EventManager.emit("arguments/add", argument, idx);
    },

    /**
     * Notify listener on argument removed
     *
     * @param {String}
     * argument Argument, that was removed
     * @param {Number}
     * Index of removed argument
     */
    _fireArgumentRemoved : function(argument, idx) {

        SCWeb.core.EventManager.emit("arguments/remove", argument, idx);
    },

    /**
     * Notify listener on argument clear
     */
    _fireArgumentCleared : function() {

        SCWeb.core.EventManager.emit("arguments/clear");
    },

    /**
     * Retrieves all available arguments to caller object.
     *
     * @returns {Array} the array of available arguments.
     */
    getArguments : function() {

        return this._arguments;
    }

};


SCWeb.core.EventManager = {
	
	events: {},
	
	/**
	 * Subscribe handler for specified event
	 * @param {String} evt_name Event name
	 * @param {Object} context Context to call callback function
	 * @param {callback} callback Callback function
	 * @returns Returns event object
	 */
	subscribe: function(evt_name, context, callback) {
		
		var event = {
			event_name: evt_name,
			func: callback,
			context: context
		};
		
		if (!this.events[evt_name]) {
			this.events[evt_name] = [event];
		} else {			
			this.events[evt_name].push(event);
		}
		
		return event;
	},
	
	/**
	 * Remove subscription
	 * @param {Object} event Event object
	 */
	unsubscribe: function(event) {
		
		for(var evt in this.events) {
			var funcs = this.events[evt];
			var idx = funcs.indexOf(event);
			if (idx >= 0) {
				funcs.splice(idx, 1);
			}
		}	
	},
	
	/**
	 * Emit specified event with params
	 * First param - is an event name. Other parameters will be passed into callback
	 */
	emit: function() {
		
		var params = Array.prototype.slice.call(arguments);
		var evt = params.splice(0, 1);
		
		var funcs = this.events[evt];
		if (funcs) {
			for (var f in funcs) {
				var e_obj = funcs[f];
				e_obj.func.apply(e_obj.context, params);
			}
		}
	}
};


// sc-element types
var sc_type_node = 0x1
var sc_type_link = 0x2
var sc_type_edge_common = 0x4
var sc_type_arc_common = 0x8
var sc_type_arc_access = 0x10

// sc-element constant
var sc_type_const = 0x20
var sc_type_var = 0x40

// sc-element positivity
var sc_type_arc_pos = 0x80
var sc_type_arc_neg = 0x100
var sc_type_arc_fuz = 0x200

// sc-element premanently
var sc_type_arc_temp = 0x400
var sc_type_arc_perm = 0x800

// struct node types
var sc_type_node_tuple = (0x80)
var sc_type_node_struct = (0x100)
var sc_type_node_role = (0x200)
var sc_type_node_norole = (0x400)
var sc_type_node_class = (0x800)
var sc_type_node_abstract = (0x1000)
var sc_type_node_material = (0x2000)

var sc_type_arc_pos_const_perm = (sc_type_arc_access | sc_type_const | sc_type_arc_pos | sc_type_arc_perm)

// type mask
var sc_type_element_mask = (sc_type_node | sc_type_link | sc_type_edge_common | sc_type_arc_common | sc_type_arc_access)
var sc_type_constancy_mask = (sc_type_const | sc_type_var)
var sc_type_positivity_mask = (sc_type_arc_pos | sc_type_arc_neg | sc_type_arc_fuz)
var sc_type_permanency_mask = (sc_type_arc_perm | sc_type_arc_temp)
var sc_type_node_struct_mask = (sc_type_node_tuple | sc_type_node_struct | sc_type_node_role | sc_type_node_norole | sc_type_node_class | sc_type_node_abstract | sc_type_node_material)
var sc_type_arc_mask = (sc_type_arc_access | sc_type_arc_common | sc_type_edge_common)



SCWeb.core.ComponentType = {
    viewer: 0,
    editor: 1
};

SCWeb.core.ComponentManager = {
    
    _listener: null,
    _initialize_queue: [],
    _componentCount: 0,
    _factories: {},
    _ext_langs: {},
    
    init: function(callback) {
        // callback will be invoked when all component will be registered
        this._componentCount = this._initialize_queue.length;

        // first of all we need to resolve sc-addrs of keynodes
        var keynodes = [];
        for (var i = 0; i < this._initialize_queue.length; i++) {
            keynodes = keynodes.concat(this._initialize_queue[i].formats);
            if (this._initialize_queue[i].ext_lang)
				keynodes.push(this._initialize_queue[i].ext_lang);
        }
        
        var self = this;
        SCWeb.core.Server.resolveScAddr(keynodes, function(addrs) {
			
            for (var i = 0; i < self._initialize_queue.length; i++) {
                var comp_def = self._initialize_queue[i];
                
                var lang_addr = addrs[comp_def.ext_lang];
                var formats = null;
                if (lang_addr) {
					formats = [];
				}
                
                for (var j = 0; j < comp_def.formats.length; j++) {
                    var fmt = addrs[comp_def.formats[j]];
                    
                    if (fmt) {
                        self.registerFactory(fmt, comp_def.factory);
                        if (formats) {
							formats.push(fmt);
						}
                    }
                }
                
                if (formats) {
					self._ext_langs[lang_addr] = formats;
				}
            }
            
            callback();
        });
    },
    
    /**
     * Append new component initialize function
     * @param {Object} component_desc Object that define component. It contains such properties as:
     * - formats - Array of system identifiers of supported formats
     * - factory - factory function (@see SCWeb.core.ComponentManager.registerFactory)
     */
    appendComponentInitialize: function(component_def) {
        this._initialize_queue.push(component_def);
    },
    
    /** Register new component factory
     * @param {Array} format_addr sc-addr of supported format
     * @param {Function} func Function that will called on instance reation. If component instance created, then returns true; otherwise returns false.
     * This function takes just one parameter:
     * - sandbox - component sandbox object, that will be used to communicate with component instance
     */
    registerFactory: function(format_addr, func) {
        this._factories[format_addr] = func;
    },
    
    /**
     * Create new instance of component window
     * @param {String} format_addr sc-addr of window format
     * @param {String} link_addr sc-addr of link, that edit or viewed with sandbox
     * @param {String} container Id of dom object, that will contain window
     * @return Return component sandbox object for created window instance.
     * If window doesn't created, then returns null
     */
    createWindowSandbox: function(format_addr, link_addr, container) {
        var factory = this._factories[format_addr];
        
        if (factory) {
            var sandbox = new SCWeb.core.ComponentSandbox(container, link_addr);
            if (factory(sandbox))
                return sandbox;
        }
        
        return null;
    },
    
    /**
     * Returns sc-addr of primary used format for specified external language
     * @param {String} ext_lang_addr sc-addr of external language
     */
    getPrimaryFormatForExtLang: function(ext_lang_addr) {
		var fmts = this._ext_langs[ext_lang_addr];
		
		if (fmts && fmts.length > 0) {
			return fmts[0];
		}
		
		return null;
	},
    
    /**
     * Setup component listener
     * @param {Object} listener Listener object. It must to has functions:
     * - onComponentRegistered - function, that call when new component registered. It receive
     * component description object as argument
     * - onComponentUnregistered - function, that calls after one of the component was unregistered.
     * It receive component description object as argument
     */
    setListener: function(listener) {
        this._listener = listener;
    },
    
    /**
     * Fires event when new component registered
     */
    _fireComponentRegistered: function(compDescr) {
        if (this._listener) {
            this._listener.componentRegistered(compDescr);
        }
    },
    
    /**
     * Fires event when any of components unregistered
     */
    _fireComponentUnregistered: function(compDescr) {
        if (this._listener) {
            this._listener.componentUnregistered(compDescr);
        }
    }
};


SCWeb.core.Server = {
    _semanticNeighborhood: {
        commandId: 'ui_menu_view_full_semantic_neighborhood',
        commandAddr: null
    },
    
    _listeners: [],
    _task_queue: [], // array of server tasks
    _task_active_num: 0, // number of active tasks
    _task_max_active_num: 10, // maximum number of active tasks
    _task_timeout: 0, // timer id for tasks queue
    _task_frequency: 100,   // task timer frequency
    
    /*!
     * Append new listener to server tasks
     * @param {Object} listener Listener object.
     * It must have such functions as:
     * - taskStarted - function that calls on new task started. No any arguments
     * - taskFinished - function that calls on new task finished. No any arguments
     */
    appendListener: function(listener) {
        if (this._listeners.indexOf(listener) == -1) {
            this._listeners.push(listener);
        }
    },
    
    /*!
     * Removes specified listener
     * @param {Object} listener Listener object to remove
     */
    removeListener: function(listener) {
        var idx = this._listeners.indexOf(listener);
        if (idx >= 0) {
            this._listeners.splice(idx, 1);
        }
    },
    
    /*!
     * Notify all registere listeners task started
     */
    _fireTaskStarted: function() {
        for (var i = 0; i < this._listeners.length; ++i) {
            $.proxy(this._listeners[i].taskStarted(), this._listeners[i]);
        }
    },
    
    /*!
     * Notify all registered listeners on task finished
     */
    _fireTaskFinished: function() {
        for (var i = 0; i < this._listeners.length; ++i) {
            $.proxy(this._listeners[i].taskFinished(), this._listeners[i]);
        }
    },
    
    /*!
     * Push new task for processing
     * @param {Object} task Object, that represents server task.
     * It contains properties such as:
     * - type - Type of ajax request (GET/POST)
     * - url - Url to call on server
     * - data - Object, that contains request parameters
     * - success - Callback function to call on success
     * - error - Callback function to call on error
     */
    _push_task: function(task) {
        this._fireTaskStarted();
        this._task_queue.push(task);
        
        if (!this._task_timeout) {
            var self = this;
            this._task_timeout = window.setInterval(function() {
                    var tasks = self._pop_tasks();
                    
                    for (idx in tasks) {
                        var task = tasks[idx];
                        self._task_active_num++;
                        $.ajax({
                            url: task.url,
                            data: task.data,
                            type: task.type,
                            success: task.success,
							error: task.error,
                            complete: function() {
                                SCWeb.core.Server._fireTaskFinished();
                                self._task_active_num--;
                            }
                        });
                    }
                    
                }, this._task_frequency)
        }
    },
    
    /**
     * Get tasks from queue for processing.
     * It returns just tasks, that can be processed for that moment.
     * Number of returned tasks is min(_task_max_active_num - _task_active_num, _task_queue.length)
     */
    _pop_tasks: function() {
        var task_num = this._task_max_active_num - this._task_active_num;
        var res = [];
        for (var i = 0; i < Math.min(task_num, this._task_queue.length); ++i) {
            res.push(this._task_queue.shift());
        }
        
        if (this._task_queue.length == 0) {
            window.clearInterval(this._task_timeout);
            this._task_timeout = 0;
        }
        
        return res;
    },
    
    // ----------------------
    
    /*!
     * Get initial data from server
     *
     * @param {Function} callback Calls on request finished successfully. This function
     * get recieved data from server as a parameter
     */
    init: function(callback) {
        this._push_task({
                type: 'GET',
                url: 'api/init/',
                data: null,
                success: callback
            });
    },

    /*!
     *
     * @param {Array} objects List of sc-addrs to resolve identifiers
     * @param {Function} callback
     */
    resolveIdentifiers: function(objects, callback) {
		
		if (objects.length == 0) return; // do nothing
		
        var data = '', id, index;
        var idx = 1;
        var used = {};
        for(var i = 1; i <= objects.length; i++) {
			id = objects[i - 1];
			
			if (used[id]) continue; // skip objects, that was processed
			used[id] = true;
            
            index = idx + '_';
            idx += 1;
            if (i != 1) data += '&';
            data += index + '=' + id;
        }

        //TODO: change to POST because the data may reach the limit of GET parameters string
        this._push_task({
            type: 'POST',
            url: 'api/idtf/resolve/',
            data: data,
            success: callback
        });
    },
    
    /*! Function to initiate user command on server
     * @param {cmd_addr} sc-addr of command
     * @param {output_addr} sc-addr of output language
     * @param {arguments_list} List that contains sc-addrs of command arguments
     * @param {callback} Function, that will be called with recieved data
     */
    doCommand: function(cmd_addr, arguments_list, callback){
    
        var arguments = {};
        for (var i = 0; i < arguments_list.length; i++){
            var arg = arguments_list[i];
            arguments[i.toString() + '_'] = arg;
        }
        arguments['cmd'] = cmd_addr;

        this._push_task({
            type: "POST",
            url: "api/cmd/do/",
            data: arguments,
            success: callback
        });
    },
    
    /*! Function to get answer translated into specified format
     * @param {question_addr} sc-addr of question to get answer translated
     * @param {format_addr} sc-addr of format to translate answer
     * @param {callback} Function, that will be called with received data in specified format
     */
    getAnswerTranslated: function(question_addr, format_addr, callback)
    {
        this._push_task({
            type: "POST",
            url: "api/question/answer/translate/",
            data: { "question": question_addr, "format": format_addr },
            success: callback
        });
    },

    /*!
     * Gets semantic neighbourhood for the specified node.
     *
     * @param {String} scAddr The SC address of node
     * @param {String} outputLanguage The output language SC address
     * @param {Function} callback
     */
    getSemanticNeighbourhood: function(scAddr, outputLanguage, callback) {
        if(this._semanticNeighborhood.commandAddr) {
            this.doCommand(this._semanticNeighborhood.commandAddr, outputLanguage, [scAddr], callback);
        } else {
            var me = this;
            this.resolveScAddr([this._semanticNeighborhood.commandId], function(addressMap) {
                me._semanticNeighborhood.commandAddr = addressMap[me._semanticNeighborhood.commandId];
                me.doCommand(me._semanticNeighborhood.commandAddr, outputLanguage, [scAddr], callback);
            });
        }
    },
    
    /*!
     * Function that resolve sc-addrs for specified sc-elements by their system identifiers
     * @param {identifiers} List of system identifiers, that need to be resolved
     * @param {callback} Callback function that calls, when sc-addrs resovled. It
     * takes object that contains map of resolved sc-addrs as parameter
     */
    resolveScAddr: function(idtfList, callback){
        var arguments = '';
        for (i = 0; i < idtfList.length; i++){
            var arg = idtfList[i];
            arguments += i.toString() + '_=' + arg + '&';
        }
        
        this._push_task({
            type: "POST",
            url: "api/addr/resolve/",
            data: arguments,
            success: callback
        });
    },
    
    /*!
     * Function that get sc-link data from server
     * @param {Array} links List of sc-link addrs to get data
     * @param {Function} success Callback function, that recieve map of
     * resolved sc-links format (key: sc-link addr, value: format addr).
     * @param {Function} error Callback function, that calls on error
     */
    getLinksFormat: function(links, success, error) {
        var arguments = '';
        for (i = 0; i < links.length; i++){
            var arg = links[i];
            arguments += i.toString() + '_=' + arg + '&';
        }
        
        this._push_task({
            type: "POST",
            url: "api/link/format/",
            data: arguments,
            success: success
        });
    },
        
    /**
     * Returns data of specified content
     * @param {String} addr sc-addr of sc-link to get data
     * @param {Function} callback Callback function, that recieve data.
     * @param {Function} error Callback function, that calls on error
     */
    getLinkContent: function(addr, success, error) {
        
        this._push_task({
                url: "api/link/content/",
                type: "GET",
                data: {"addr": addr},
                success: success,
                error: error
            });
    },
    
    /**
     * Returns list of available natural languages
     */
    getLanguages: function(callback) {
		this._push_task({
			url: "api/languages/",
			type: "GET",
			data: null,
			success: callback
		});
	},
	
	/**
	 * Setup default natular language for user
	 * @param {String} lang_addr sc-addr of new language to setup
	 */
	setLanguage: function(lang_addr, callback) {
		this._push_task({
			url: "api/languages/set/",
			type: "POST",
			data: {"lang_addr": lang_addr},
			success: callback
		});
	}
};




/**
 * This object conrols available modes for natural languages (russina, english ant etc.)
 * It can fires next events:
 * - "translation/update" - this event emits on mode changed. Parameter: dictionary, that contains new translation
 * - "translation/get" - this event emits to collect all objects for translate. Parameter: array, that need to be filled by listener 
 * (this array couldn't be cleared, listener just append new elements).
 */
SCWeb.core.Translation = {
    
    listeners: [],
       
    /** Updates all translations
     */
    update: function(callback) {
         
        // collect objects, that need to be translated
        var objects = this.collectObjects();
        
        // @todo need to remove duplicates from object list
        // translate
        var self = this;
        this.translate(objects, function(namesMap) {
			self.fireUpdate(namesMap);
            callback();
        });
        
     },
      
    /**
     * Do translation routines. Just for internal usage.
     * @param {Array} objects List of sc-addrs, that need to be translated
     * @param {Function} callback
     * key is sc-addr of element and value is identifier.
     * If there are no key in returned object, then identifier wasn't found
     */
    translate: function(objects, callback) {

        var self = this;
        SCWeb.core.Server.resolveIdentifiers(objects, function(namesMap) {
			callback(namesMap);
        });
    },
    
    /** Change translation language
     * @param {String} lang_addr sc-addr of language to translate
     * @param {Function} callback Callbcak function that will be called on language change finish
     */
    setLanguage: function(lang_addr, callback) {
		var self = this;
		SCWeb.core.Server.setLanguage(lang_addr, function() { 
			self.translate(self.collectObjects(), function (namesMap) {
				self.fireUpdate(namesMap);
				callback();
			});
		});
	},
	
	/** Fires translation update event
	 * @param {Dict} namesMap Dictionary that contains translations
	 */
	fireUpdate: function(namesMap) {
		// notify listeners for new translations
		SCWeb.core.EventManager.emit("translation/update", namesMap);
	},
	
	/** Collect objects for translation
	 */
	collectObjects: function() {
		var objects = [];
        SCWeb.core.EventManager.emit("translation/get", objects);
        return objects;
	},
	
	/** Request to translate objects
	 * @param {Array} objects Array of objects to translate
	 */
	requestTranslate: function(objects) {
		var self = this;
		this.translate(objects, function(namesMap) {
			self.fireUpdate(namesMap);
		});
	}
    
};


SCWeb.core.Main = {
    
    window_types: [],
    idtf_modes: [],
    menu_commands: {},
    default_cmd_str: "ui_menu_view_full_semantic_neighborhood",
    
    /**
     * Initialize sc-web core and ui
     * @param {Object} params Initializetion parameters.
     * There are required parameters:
     * - menu_container_id - id of dom element, that will contains menu items
     */
    init: function(params, callback) {
        var self = this;
        SCWeb.ui.Locker.show();
        
        SCWeb.ui.TaskPanel.init(function() {
        
            SCWeb.core.Server.init(function(data) {
                self.window_types = data.window_types;
                self.lang_modes = data.lang_modes;
                self.menu_commands = data.menu_commands;
                self.user = data.user;
                
                var menu_params = {
                                menu_container_id: params.menu_container_id,
                                menu_commands: self.menu_commands
                            };
                SCWeb.ui.Menu.init(menu_params, function() {
                
                    SCWeb.ui.ArgumentsPanel.init(function() {
                
                        SCWeb.ui.UserPanel.init(data.user, function() {
							
							SCWeb.ui.LanguagePanel.init(data, function() {
                            
								SCWeb.ui.WindowManager.init(data, function() {
									
									SCWeb.core.ComponentManager.init(function() {
									
										SCWeb.core.DialogHistory.init(function() {
									
											SCWeb.core.Translation.update(function() {	
												callback();
												SCWeb.ui.Locker.hide();
											});
										});
									});
								});
							});
                        });
                    });
                });
            });
        });
    },

    _initUI: function() {

    },
    
    /**
     * Returns sc-addr of preffered output language for current user
     */
    getDefaultExternalLang: function() {
		return this.user.default_ext_lang;
	},
    
    /**
     * Initiate user interface command
     * @param {String} cmd_addr sc-addr of user command
     * @param {Array} cmd_args Array of sc-addrs with command arguments
     */
    doCommand: function(cmd_addr, cmd_args) {
		SCWeb.core.Server.doCommand(cmd_addr, cmd_args, function(result) {
			if (result.question != undefined) {
				SCWeb.ui.WindowManager.appendHistoryItem(result.question);
			}
		});
	},
	
	/**
     * Initiate default user interface command
     * @param {Array} cmd_args Array of sc-addrs with command arguments
     */
	doDefaultCommand: function(cmd_args) {
		if (!this.default_cmd) {
			var self = this;
			SCWeb.core.Server.resolveScAddr([this.default_cmd_str], function(addrs) {
				self.default_cmd = addrs[self.default_cmd_str];
				if (self.default_cmd) {
					self.doCommand(self.default_cmd, cmd_args);
				}
			});
		} else {
			this.doCommand(this.default_cmd, cmd_args);
		}
	},
	
};



/**
 * Object controls history of dialog
 * It can fires next events:
 * - "history/add" - this event emits on new history item add. Parameters: addr
 * where:
 * 		- addr - is a sc-addr of history item;
 */
SCWeb.core.DialogHistory = {
	
	init: function(callback) {
		
		
		callback();
	},
		
};


