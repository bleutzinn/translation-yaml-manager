var ymlbuilder = {
	options : { 
		default_lang  : 'en',
		stickyHeaders : true,
		yml_path      : 'yaml/',	// path to the YAML files
		API           : '',		    // back-end REST URL which should save the response 
	},
	
	// Application texts
	texts : {
		error		: 'error, try again',
		removeCol	: 'Remove column',
		done		: 'done',
		revert		: 'Reverts the text to original prior to editing',
		edit_entry	: 'edit in larger view',
		largeView	: {
			confirm : 'done',
			revert	: 'revert'
		},
		yamlPath	:  'YAML path is:'
	},
	
	// make language columns' headers sticky
	sticky : (function(w){
		var items = [], scrollTop, i;
		return {
			init : function(){
				$(w).on('scroll', function() {
					scrollTop = w.pageYOffset || document.body.scrollTop;
					for( i = items.length; i--; )
						items[i].style.top = scrollTop + 'px';
				});
			},
			update : function(){
				items.length = 0;
				items = $.makeArray( $('header') );
			}
		}
	})(window),
	
	init : function(){
		var that = this;
		
		$.when( $.getJSON("template.json") )
			.done(function(RES){
				ymlbuilder.template = RES;
			})
			.then( 
				that.getYAML(that.options.default_lang, $('#source')) 
				.done(function(data, column){
					column.append( that.builder(data) );
				})
			);
			
	
		// Preloads the default language to the "source" column, which is the first and only one at the beginning
	//	this.getYAML(this.options.default_lang, $('#source'), function(data, column){
	//		var fragment = this.builder(data);
	//		column.append( fragment );
	//	});
		
		$('.langSelect:first').val(this.options.default_lang);

		this.events();	// create the events for all user interactions
		
		if( this.options.stickyHeaders ){
			this.sticky.update();
			this.sticky.init();
		}
	},
    
	/**
	 * Returns the JSON representation of a YAML file
	 * @param [String] lang - the language file to get
	 * @param [jQuery Object] column - the column for which the language is to be loaded
	 * @param [Function] callback - a callback function to be fired after the fetching of the JSON is done
	 *
	*/
	getYAML: function(lang, column, callback){
		callback = callback || function(){}; // make sure callback is a function in case it isn't
		
		var that = this,
			deferred = $.Deferred();
		
		clientParsed();
		//serverParsed();
		
		// returns the JSON representation of a YAML file using client-side YAML parser
		function clientParsed(){
			onStart();
			YAML.fromURL( ymlbuilder.options.yml_path + lang+'.yml', function(data){
				//console.log(data);
				onComplete();
				
				var errors = YAML.getErrors();
				
				if( errors.length ){
					console.warn( errors );
					onError();
					return;
				}
				
				onSuccess(data);
			});
		}
		
		// returns the JSON representation of a YAML file, pre-made on the SERVER side.
		// NOTE: this should be done on the server side, by an API that converts YAML files to json format.
		function serverParsed(){
			$.ajax({
				url: ymlbuilder.options.yml_path + lang +'.json',
				dataType: 'json',
				timeout: 9000,
				beforeSend: onStart,
				complete: onComplete,
				success: onSuccess,
				error: onError
			});
		}
		
		function onStart(){
			column.addClass('loading');
		}
		
		function onComplete(){
			column.removeClass('loading');
		}
		
		function onSuccess(data){
			column.toggleClass(lang + ' loaded', true);
            column.find('.msg').empty();
			callback.apply(that, [data[lang], column]);
			deferred.resolve( data[lang], column );
		}
		
		function onError(data){
            var err = $('<span>').addClass('type2').text(ymlbuilder.texts.error);
			column.find('.msg').html( err );
			//callback.apply(that, [data, column]);
			
			deferred.reject();
		}
		
		return deferred;
	},

	
	// returns the DOM element of the (YAML) json with the json template
	builder : function(ymlJSON){
		//console.log( data );
		var result, dom;

		// store the JSON in the language holder so it can be modified later
		// merge yml data with empty template data
		// data = $.extend(true,{},this.templateJSON, data);
		result = $.extend(true,{}, this.template ); // clone the template object to keep it from being modified
		this.mergeObjects( result, ymlJSON );	// result object returned modified
		// build DOM from JSON
		dom = this.createDom( result, 0 );
		
		// Eliminates the '_REF's that are instances of the original so they won't be displayed but still present in the DOM
		dom.find('.ref').each(function(){
			//$(this).find('input')
			var refPath = this.getElementsByTagName('input')[0].value.split('.').reverse(),
				actualPath = $(this).parents('li').find('.title:first').toArray();

			for( var i = refPath.length; i--; ){
				if( refPath[i] != actualPath[i].textContent ){
					this.parentNode.parentNode.style.display = 'none';
					break;
				}
			}
		});
		
		return dom;
	},
	
	// Merges 2 objects but don't create new keys for the first object (which is the template)
	// The master template is ALWAYS managed through the jsonTemplate.js to prevent direct changes to the YAML files.
	mergeObjects : function(obj1, obj2){
		for( var p in obj2 ){
			if( obj1.hasOwnProperty(p) )
                obj1[p] = typeof obj2[p] === 'object' ? this.mergeObjects(obj1[p], obj2[p]) : obj2[p];
		}
		return obj1;
	},

	// return a DOM element built from a json element which was merged with the json template
	createDom : function(data, level){
		var listElm, title, items = [];
        
		listElm = $('<ul>').prop('class','level'+level);
        
		for( var key in data ){
			//console.log( level, key );
			if( data.hasOwnProperty(key) ){
				if( key.indexOf('xxx') != -1 ){
					items.push('<li class="comment">' + data[key] +'</li>');
				}
				else{
					title = '<span class="label">'+ key +'</span>';

					if( typeof data[key] === 'string' ){
						var input = '<input type="text" value="'+ data[key] +'">',
							plus = '<b class="plus" title="' + ymlbuilder.texts.edit_entry + '">+</b>',
							// hide the "_ref" lines so they are still in the DOM and will be converted back to JSON later
							itemClass = key.indexOf('_ref') != -1 ? 'ref' : 'data';
						items.push('<li class="'+ itemClass +'">' + plus + title + input +'</li>');
					}

					else if( data[key] && typeof data[key] === 'object' ){
						title = '<span class="title">'+ key +'</span>';
						items.push('<li>' + title + '<ul class="level'+ level+1 +'">' + this.createDom(data[key], level+1).html() + '</ul></li>');
					}
				}
			}
		}
		listElm.html( items.join('') );
		return listElm;
	},
	
	domToJson : function(root){
		var result = {};
		
		$('> ul > li > span', root).each(function(idx, span){
			result[ $(span).text() ] = $(span).hasClass('title') ? ymlbuilder.domToJson( $(span).parent() ) : $(span).next('input').val();
		});

		return result;
	},
	
	events : function(){
		var that = this;
		
		/* LargeView - for easier text editing
		*/
		function LargeView(){
			this.container = null;
			this.defaultValue = '';
			this.viewerObj = $('<div>').addClass('viewer');
		};
		
		LargeView.prototype.revert = function(){
			this.viewerObj.find('.value').text( this.defaultValue );
		};
		
		// copy to input element and close the modal window. autosave if text has changed.
		LargeView.prototype.close = function(){
			var that = this,
				viewerObjVal = this.viewerObj.find('.value').text(),
				$input = this.container.find('input'),
				changed = ( $input.val() != viewerObjVal );
			
			$input.val( viewerObjVal ); // change the input text
			markLine.blur(this.viewerObj);	// un-mark the line's title
			this.viewerObj.hide(160,function(){
				that.viewerObj.remove(); // kill the viewerObj
			});
			
			// Autosave if input has changed
			if( changed )
				autosave.apply( $input[0] );
		};
		
		LargeView.prototype.open = function(e){
			this.container = $(e.target).parents('li:first');
			var c = this.container;
			// make sure viewerObj won't be added if already exist
			if( c.find('.viewer').length )
				return;
			// init all DOM elements to be injected
			var	val = c.find('input')[0].value,
				label = $('<h2>').text( c.find('span:first').text() ),
				original =  $('<div>').addClass('value').text( val ).prop('contenteditable',true),
				textarea =  $('<textarea>').text( val ),
				save = $('<button>').text(ymlbuilder.texts.largeView.confirm).click( $.proxy(this, 'close') ),
				revert = $('<button>').prop('title', ymlbuilder.texts.revert).text(ymlbuilder.texts.largeView.revert).click( $.proxy(this, 'revert') );
			
			this.defaultValue = c.find('input')[0].defaultValue;
			
			// check if a largeView item already exists for this Column
			this.viewerObj.empty().append(original, $('<div>').addClass('options').append(revert, save) );
			
			this.viewerObj.appendTo(c).fadeIn(120);
			
			$('.value').keypress(function(e){
				if(e.keyCode == 13)
					return false;
			});
		};
			
		/* Add a new column
		*/
		function addLang(){
			var clonedColumn, header;
			
			$(this).parents('.col').removeClass('empty');
			// make another "empty" col (with just an "add language" button)
			clonedColumn = $(this).parents('.col').clone().addClass('empty');
			clonedColumn.find('> header .msg').empty();
			clonedColumn.appendTo('#wrap');
			setTotalWidth();
			// replce the header with the source column's header (which is the template for a header)
			header = $('#source > header').clone();
			header.prepend('<b class="close" title="' + ymlbuilder.texts.removeCol + '">&times;</b>');
			$(this).parent().html( header );
			
			if( ymlbuilder.options.stickyHeaders )
				ymlbuilder.sticky.update();
		}
		
		/* removes a whole language column
		*/
		function removeColumn(){
			$(this).parents('.col').hide(300, function(){
				$(this).remove();
				setTotalWidth();
			});
		}
		
		/*	Calculates and set the total width of the document according to the number of Columns in it
		*/
		function setTotalWidth(){
			var width_source = $('#source').outerWidth(true),
				cols = $('#wrap').find('> .col');
			$('#wrap').width( width_source + ((cols.length-2) * cols.eq(1).outerWidth(true)) + cols.eq(-1).outerWidth(true) + 5 );
		}
		
		/* Change the current column language
		*/
		function changeLang(){
			var lang = this.value,
				col = $(this).parents('.col');

			col[0].className = 'col '+ lang;
			// remove the column before trying to build another one (in case something fails, at least the user won't see the last column that was in use and think it's functional)
			col.find('> .level0').remove();
			
			that.getYAML(lang, col, function(data){
                showEmptyValues.showAll();
				var fragment = this.builder(data);
				// make sure that if some columns are collapsed, they will also appear collapsed on the newly-added column
				checkCollapseColumns(fragment);
				col.append( fragment );
			});
		}
		
		/* auto saves the column
		*/
		function autosave(){
			save.apply( this );
		}
		
		/* Save current column state to the server after converting back to JSON
		*/
		function save(){
			var $dom     = $(this).parents('.col'),
				$msg     = $dom.find('> header .msg'),
				$saveBtn = $dom.find('> header .save'),
				json     = ymlbuilder.domToJson($dom),
				lang     = $dom[0].className.split(' ')[1]; // get the langauge for the COLUMN
				
			// wrap the JSON object with the language key and send to server
			//var newJSON = {};
			//newJSON[lang] = json;
			//console.log(newJSON);
			
			// sends JSON data to server
			$.ajax({
				url         : ymlbuilder.options.API,
				type        : 'PUT',
				contentType :'application/json',
				dataType    :'json',
				timeout     : 10000,
				data        : JSON.stringify(json),
				beforeSend  : beforeSave,
				error       : errorSave,
				success     : confirmSave
			});
			
			function errorSave(){
				$saveBtn.prop('disabled',false);
				$msg.empty();
				$('<span>').addClass('type2').text(ymlbuilder.texts.error).appendTo($msg);
			}
			
			function beforeSave(){
				$saveBtn.prop('disabled',true);
			}
			
			function confirmSave(){
				$saveBtn.prop('disabled',false);
				$msg.empty();
				
				$('<span>')
					.addClass('type1')
					.text(ymlbuilder.texts.done)
					.appendTo($msg)
					.delay(600)
					.fadeOut(600, function(){ 
						$(this).remove(); 
					});
			}
		}
		
		/* Maximize / Minimize the UL lists of texts
		*/
		var minmax = (function(){
            // for a single thread
            function single(){
                var list = $(this).next('ul');

                findPath( getPath(list) );
                
                /* get the path for the current clicked list that should be collapsed or un-collapsed.
                 * 'path' is made of idexes for every 'li' element up along the dom
                */
                function getPath( elm ){
                    var path = [], index;
                    elm.parentsUntil( $("div.col"), "li").each(function(){
                        path.push( $(this).index() );
                    });
                    
                    return path;
                }
                
                /* finds all the elements that SHOULD be changed in all the columns
                */
                function findPath( path ){
                    $('#wrap').find('.col.loaded').each(function(){
                        var current = $(this).find('.level0'), i = path.length;
                        // loop on every index in the path and go deeper until the last 'UL' is found, and 'toggle' it
                        for( i; i--; ){
                            current = current.children('li').eq( path[i] ).find('> ul');
                        }
                        // once found the most bottom element, change it's state accordingly
                        toggle(current);
                    });
                }
                
                function toggle( elm ){
                    var h = elm.height(), 
                        speed = 0.2 * h + 180;

                    elm.slideToggle(speed, 'easeOutQuad');
                    elm.parent().toggleClass('closed');
                }
            };
            
            var minimized = false;
            // for a all threads
            function all(){
                if( minimized ){
                    $('.title').next('ul').show().parent().removeClass('closed');
                    minimized = false;
                }
                else{
                    $('.title').next('ul').hide().parent().addClass('closed');
                    minimized = true;
                }
            };
            
            return {
                single: single,
                all:    all
            }
		})();
        
		/*	checks if any KEY should be collapsed (for a newely added language column) 
			by scanning the master column (#source) and changing the new column acordingly
		*/
		function checkCollapseColumns( frag ){
			// for each collapsed element
			$('#source').find('li.closed').each(function(){
				// find the DOM path (index based) for each collaped list
				var path = getPath(this);
				findPath( path );
			});
			// get the path of the collapsed element
			function getPath( elm ){
				var path = [], index;
				$(elm).find('> ul').parentsUntil( $("div.col"), "li").each(function(){ 
					path.push( $(this).index() )
				});
				return path;
			}
			// Find all places that should be collapsed with the exact same path (from getPath())
			function findPath( path ){
				var current = frag, i = path.length;
				for( i; i--; )
					current = current.children('li').eq( path[i] ).find('> ul');
				current.hide().parent().toggleClass('closed');
			}
		}
		
		/* give focus to the title on field's focus
		*/
		var markLine = {
			focusedElement : null,
			
			focus : function(){
				var listItem = markLine.path.find( markLine.path.get(this) );
				markLine.focusedElement = listItem.find('span').addClass('focus');
			},
			
			blur : function(elm){
				if( elm ){
					var listItem = markLine.path.find( markLine.path.get(elm) );
					listItem.find('span').removeClass('focus');
				}
				else
					markLine.focusedElement.removeClass('focus');
			},
			
			path : {
				// return the path as an Index array
				get : function(elm){
					var p = [], index;
					$(elm).parentsUntil( $("div.col"), "li").each(function(){ 
						p.push( $(this).index() )
					});
					return p;
				},
				// return an element from an index-array path
				find : function( path ){
					var current = $('#source'), i = path.length;
					for( i; i--; ){
						current = current.find('> ul > li').eq( path[i] );
					}
					return current;
				}
			}
		}
		
		// returns the path of spesific KEY in the tree-view that represents the YAML file
		function getYamlPath(e){
			var p = [], index;
			$(this).parentsUntil( $('div.col'), 'li').each(function(){ 
				p.push( $(this).find('> span').text() );
			});
			console.log(ymlbuilder.texts.yamlPath)
			console.warn( p.reverse().join('.') );
		}
        
        // show only the lines which were not translated
        var showEmptyValues = (function(){
            var checkbox = $('#extraMenu').find('.showEmptyValues');
            
            function toggle(){
                if( this.checked )
                    hideEmptyThreads();
                else
                    showAllThreads(); 
            }
            
            function hideEmptyThreads(){
                $('body').addClass('onlyEmpty');
                
                // scan the column with the higest number of empty inputs
                $('.col').find('input').each(function(){
                    if( !this.value.length ){
                        //$(this).parent('li').show()//.parent('ul').addClass('hasEmpty');
                        var path = getPath( this );
                        findPath(path);
                    }
                });
            }
            
            function showAllThreads(){
                $('body').removeClass('onlyEmpty');
                $('.hasEmpty').removeClass('hasEmpty');
                checkbox.prop('checked',false);
            }
            
            function getPath( elm ){
                var p = [], index;
                $(elm).parentsUntil( $(".level0"), "li").each(function(){ 
                    p.push( $(this).index() )
                });
                return p;
            }
            
            function findPath( path ){
                $('#wrap').find('.col.loaded').each(function(){
                    var current = $(this), i = path.length;
                    // loop on every index in the path and go deeper until the last 'UL' is found, and 'toggle' it
                    for( i; i--; )
                        current = current.find('> ul').find('> li').eq( path[i] );
                    // once found the most bottom element, change it's state accordingly
                    current.show().parents('li').addClass('hasEmpty');
                });
            }
            
            return {
                toggle : toggle,
                showAll : showAllThreads
            }
        })();
        
		setTotalWidth(); // initial set the total width of the columns
		
		/* -------- ALL BINDING EVENTS (for user interactions) ----------*/
		$('#extraMenu')
            .on('change', '.minmax', minmax.all)
            .on('change', '.showEmptyValues', showEmptyValues.toggle)
            
        $('#extraMenu').find(':checkbox').prop('checked',false);
        
		$(document)
			.on('change', '.col input', autosave)
			.on({'focus':markLine.focus, 'blur':markLine.blur}, '.col input')
			.on('click', 'span.title', minmax.single)
			.on('click', '.addLang', addLang)
			.on('click', '.label', getYamlPath)
			.on('click', '.col > header .save', save)
			.on('click', '.col > header .close', removeColumn)
			// language selection
			.on('change', '.col > header .langSelect', changeLang)
			// larger view
			.on('click', '.col .plus', function(e){
				markLine.focus.apply(this);
				var largeView = new LargeView;
				largeView.open(e);
			});
	}
};

