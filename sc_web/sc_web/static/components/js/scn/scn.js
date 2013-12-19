$.namespace('Ostis.ui.scn');

Ostis.ui.scn.IdentifierGenerator = (function() {

    var sequenceNumber = 0;
    var _nextSequenceNumber = function() {

        return sequenceNumber++;
    };

    return {
        generateLinkId : function(viewerId, linkAddr) {

            return viewerId + "_" + linkAddr + "_" + _nextSequenceNumber();
        }
    };
})();

Ostis.ui.scn.Viewer = function(sandbox) {
        this._init(sandbox);
};

Ostis.ui.scn.Viewer.prototype = {
        _init: function(sandbox) {
                this.viewerId = sandbox.container;
                this.viewerSelector = '#' + this.viewerId;
                this.htmlBuilder = Ostis.ui.scn.HtmlBuilder(this.viewerId);
                this.selectionHandler = Ostis.ui.scn.Selection(this.viewerId);
                this.selectionHandler.init();
                this.nodeLabels = [];
                this.toTranslate = [];
                this.currentLanguage = null;
                this.sandbox = sandbox;
                
                
                this.sandbox.eventDataAppend = $.proxy(this.receiveData, this);
                this.sandbox.eventGetObjectsToTranslate = $.proxy(this.getObjectsToTranslate, this);
                this.sandbox.eventApplyTranslation = $.proxy(this.updateTranslation, this);
        },

    _initNodes: function() {

        var translXPath = this.viewerSelector + " ["
                + Ostis.ui.scn.HtmlAttributes.LABEL + "]";
        var self = this;
        $(translXPath).each(function(index, element) {

            self.nodeLabels.push(element);
            var scnAddr = $(element).attr(Ostis.ui.scn.HtmlAttributes.LABEL);
            self.toTranslate.push(scnAddr);
        });
    },

    _loadLinksData: function() {

        var linksXPath = this.viewerSelector + " ["
                + Ostis.ui.scn.HtmlAttributes.LINK + "]";
        var containers = {};
        
        $(linksXPath).each(
                function(index, element) {

                    var scAddr = $(element).attr(
                            Ostis.ui.scn.HtmlAttributes.LINK);
                    var containerId = $(element).attr(
                            Ostis.ui.scn.HtmlAttributes.HTML_ID);
                                        containers[scAddr] = containerId;
                });
                
         this.sandbox.createViewersForScLinks(containers,
                                                        function() { // success

                            }, function() { // error

                            });

    },
    
    
    /**
         * to support component interface
         */
        // -----
        receiveData : function(data) {
				var outputData;
				var me = this;
				var relation = ["nrel_system_identifier", "nrel_main_idtf", "nrel_idtf", "doc_nrel_subproject"];
				SCWeb.core.Server.resolveScAddr(relation,
					function(addressMap){
						outputData = me.htmlBuilder.buildTree(addressMap, data, relation);
						//alert(outputData);
						me.nodeLabels = [];
                		me.toTranslate = [];
                		$(me.viewerSelector).empty().append(outputData);
						me.selectionHandler.preselectArguments();
				        me._initNodes();
				        me._loadLinksData();
				});
				//this.htmlBuilder.buildTree(addressMap, data);
                //this.nodeLabels = [];
                //this.toTranslate = [];
                //$(this.viewerSelector).empty().append(outputData);
                //this.selectionHandler.preselectArguments();
                //this._initNodes();
                //this._loadLinksData();
        },

        updateTranslation : function(namesMap) {

                for ( var nodeInd = 0; nodeInd < this.nodeLabels.length; nodeInd++) {
                        var nodeEl = this.nodeLabels[nodeInd];
                        var addr = $(nodeEl).attr(Ostis.ui.scn.HtmlAttributes.LABEL);
                        var label = namesMap[addr];
                        if (label) {
                                $(nodeEl).text(label);
                        }
                }
        },
        
        getObjectsToTranslate : function() {
                return this.toTranslate;
        }
        
};

Ostis.ui.scn.HtmlBuilder = function(parentId) {

    var MARKERS = {
        SYNONIM : "=",
        SET_ELEMENT : "•"
    };

    var doViewerNodeModifications = function(node) {
	if (node.set) {
            for ( var setArcInd = 0; setArcInd < node.SCArcs.length; setArcInd++) {
                var setArc = node.SCArcs[setArcInd];
                setArc.marker = MARKERS.SET_ELEMENT;
            }
        }
    };

    var _buildNode = function(node) {
	
	    var output = '';
        doViewerNodeModifications(node);
        output += _startWrapper(node);
        if (node.keyword) {
            output += _buildKeywordNode(node);
	    } else {
            output += _buildNodeContent(node);
	    }
        output += _buildSynonyms(node);
	    output += _buildSentences(node);
	    output += _closeWrapper(node);
	    return output;
    };

    var _buildKeywordNode = function(node) {

        var result = "<div "
                + Ostis.ui.scn.HtmlAttributeBuilder
                        .buildClassAttr(Ostis.ui.scn.SCnCssClass.KEYWORD) + ">";
        result += _buildAtomicNode(node);
        result += "</div>";
        return result;
    };

    var _buildAtomicNode = function(node) {

        var atomicNode = _startSelectableNode(node);
        atomicNode += _getNodeLabel(node);
        atomicNode += _closeSelectableNode();
        return atomicNode;
    };

    var _startSelectableNode = function(node) {

        var cssClass = Ostis.ui.scn.SCnCssClass.LINK + " "
                + Ostis.ui.scn.SCnCssClass.SELECTABLE;
        return "<a " + Ostis.ui.scn.HtmlAttributeBuilder.buildScnIdAttr(node)
                + " "
                + Ostis.ui.scn.HtmlAttributeBuilder.buildClassAttr(cssClass)
                + ">";
    };

    var _getNodeLabel = function(node) {

        return "<span "
                + Ostis.ui.scn.HtmlAttributeBuilder.buildLabelAttr(node) + ">"
                + node.id + "</span>";
    };

    var _closeSelectableNode = function() {

        return "</a>";
    };

    var _buildSynonyms = function(node) {

        var sentOut = '';
        if (node.SCSynonims) {
            for ( var synInd = 0; synInd < node.SCSynonims.length; synInd++) {
                sentOut += _buildOneSynonym(node.SCSynonims[synInd]);
            }
        }
        return sentOut;
    };

    var _buildSentences = function(node) {

        var sentOut = '';
        if (node.SCArcs) {
            for ( var arcInd = 0; arcInd < node.SCArcs.length; arcInd++) {
                sentOut += _buildOneSentence(node.SCArcs[arcInd]);
            }
        }
        return sentOut;
    };

    var _buildAttrValue = function(arc) {

        var attrRes = '';
        var allAttr = arc.SCAttributes;
        for ( var attrInd = 0; attrInd < allAttr.length; attrInd++) {
            var attribute = allAttr[attrInd];
            attrRes += _buildSingleAttribute(attribute);
        }
        return attrRes;
    };

    var _buildSingleAttribute = function(attr) {

        return _buildAtomicNode(attr) + ":";
    };

    var _buildNodeValue = function(arc) {

        return _buildNode(arc.SCNode);
    };

    var _buildSentenceBegin = function() {

        return "<div "
                + Ostis.ui.scn.HtmlAttributeBuilder
                        .buildClassAttr(Ostis.ui.scn.SCnCssClass.SENTENCE)
                + ">";
    };

    var _buildSentenceEnd = function() {

        return "</div>";
    };

    var _buildOneSynonym = function(node) {

        var resSen = _buildSentenceBegin();
        resSen += _buildSynonymField(node);
        resSen += _buildSentenceEnd();
        return resSen;
    };

    var _buildSynonymField = function(node) {

        var fieldRes = "<div ";
        var fieldClass = Ostis.ui.scn.SCnCssClass.FIELD;
        fieldRes += Ostis.ui.scn.HtmlAttributeBuilder
                .buildClassAttr(fieldClass);
        fieldRes += ">";
        fieldRes += _buildStaticMarker(MARKERS.SYNONIM);
        fieldRes += _buildNode(node);
        fieldRes += "</div>";
        return fieldRes;
    };

    var _buildOneSentence = function(arc) {

        var resSen = _buildSentenceBegin();
        var buildMarker = true;
        var shiftLevel = false;
        if (arc.SCAttributes) {
            var attrFuncProxy = $.proxy(_buildAttrValue, this);
            resSen += _buildField(arc, attrFuncProxy, buildMarker, shiftLevel);
            buildMarker = false;
            shiftLevel = true;
        }
        if (arc.SCNode) {
            var nodeValFuncProxy = $.proxy(_buildNodeValue, this);
            resSen += _buildField(arc, nodeValFuncProxy, buildMarker,
                    shiftLevel);
        }
        resSen += _buildSentenceEnd();
        return resSen;
    };

    var _buildField = function(arc, valContVisitor, buildMarker, shiftLevel) {

        var fieldRes = "<div ";
        var fieldClass = Ostis.ui.scn.SCnCssClass.FIELD;
        if (shiftLevel) {
            fieldClass = fieldClass + " " + Ostis.ui.scn.SCnCssClass.LEVEL;
        }
        fieldRes += Ostis.ui.scn.HtmlAttributeBuilder
                .buildClassAttr(fieldClass);
        fieldRes += ">";
        if (buildMarker && (arc.type || arc.marker)) {
            fieldRes += _buildSelectableMarker(arc);
        }
        fieldRes += _buildValue(arc, valContVisitor);
        fieldRes += "</div>";
        return fieldRes;
    };

    var _buildStaticMarker = function(marker) {

        var markerRes = "<div "
                + Ostis.ui.scn.HtmlAttributeBuilder
                        .buildClassAttr(Ostis.ui.scn.SCnCssClass.MARKER) + ">";
        markerRes += marker;
        markerRes += "</div>";
        return markerRes;
    };

    var _buildSelectableMarker = function(arc) {

        var markerRes = "<div "
                + Ostis.ui.scn.HtmlAttributeBuilder
                        .buildClassAttr(Ostis.ui.scn.SCnCssClass.MARKER) + ">";
        markerRes += _startSelectableNode(arc);
        var markerView = arc.marker ? arc.marker : Ostis.ui.scn.TypeResolver
                .resolveArc(arc.type, arc.backward);
        markerRes += markerView;
        markerRes += _closeSelectableNode();
        markerRes += "</div>";
        return markerRes;
    };

    var _buildValue = function(arc, valContVisitor) {

        var valRes = "<div "
                + Ostis.ui.scn.HtmlAttributeBuilder
                        .buildClassAttr(Ostis.ui.scn.SCnCssClass.VALUE) + ">";
        valRes += valContVisitor(arc);
        valRes += "</div>";
        return valRes;
    };

    var _buildNodeContent = function(node) {
	var nodeCont = '';
        if (node.contour) {
            nodeCont += _buildContourContent(node);
        } else if (node.type & sc_type_link) {
            nodeCont = Ostis.ui.scn.HtmlLinkBuilder.buildLink(parentId, node);
        } else if (node.id && !node.set) {
            nodeCont = _buildAtomicNode(node);
        }
        return nodeCont;
    };

    var _startWrapper = function(node) {
	    var result = '';
        if (node.set) {
            result = "<div "
                    + Ostis.ui.scn.HtmlAttributeBuilder.buildScnIdAttr(node)
                    + " "
                    + Ostis.ui.scn.HtmlAttributeBuilder
                            .buildClassAttr(Ostis.ui.scn.SCnCssClass.SELECTABLE)
                    + ">";
            result += "<div>{</div>";
        } else if (node.contour) {

            var contourClass = Ostis.ui.scn.SCnCssClass.SELECTABLE + " "
                    + Ostis.ui.scn.SCnCssClass.LOOP;
            result = "<span "
                    + Ostis.ui.scn.HtmlAttributeBuilder.buildScnIdAttr(node)
                    + " "
                    + Ostis.ui.scn.HtmlAttributeBuilder
                            .buildClassAttr(contourClass) + ">";
        }
        return result;
    };

    var _closeWrapper = function(node) {

        var result = '';
        if (node.set) {
            result = "<div>}</div></div>";
        } else if (node.contour) {
            result = "</span>";
        }
        return result;
    };

    var _buildContourContent = function(node) {

        var outCont = '';
        for ( var keywInd = 0; keywInd < node.SCNodes.length; keywInd++) {
            outCont += _buildNode(node.SCNodes[keywInd]);
        }
        return outCont;
    };
	
	//input data - json string!
    var _sortDataByRelation = function(addressMap, dataObject, relation){
		//alert("Now in _sortData!");
		//alert("addressMap: " + JSON.stringify(addressMap));
		//alert("dataObject: " + JSON.stringify(dataObject));
		//alert(relation);
		var data = JSON.stringify(dataObject);
		var data2front = '';
		var data2back = '';
		//Подготовили начало объекта
		data2front += data.substr(0, data.indexOf("\"SCArcs\":")+9);
		//Подготовили конец объекта		
		data2back += data.substr(data.lastIndexOf("],")+1, data.length);
		//Оставили только дуги в data
		data = data.slice(data.indexOf("\"SCArcs\":")+9, data.length);
		data = data.slice(0, data.lastIndexOf("],")+1);
		//Показали data;
		//alert("This is data: "+data);
		//Получили массив объектов, содержащий дуги, выходящие из keyword узла.
		//Дуги содержат в себе узлы к которым они проведены.
		var arcNodes = JSON.parse(data);
		//alert("This is addressMap: " + JSON.stringify(addressMap));
		var toPosition = 0;
		for (var g=0; g<relation.length; g++){
			for (var i=0; i<arcNodes.length; i++){
				//Проверка наличия аттрибутов у дуги.
				if (arcNodes[i]["SCAttributes"] != undefined){
					//Если аттрибуты у дуги есть, то проходим по ним и сравниваем с адресом искомого аттрибута.
					for (var j=0; j<arcNodes[i]["SCAttributes"].length; j++){
						//alert("Дуга с аттриубтом");
						//alert("Текущее значение relation:" + addressMap[relation[g]]);
						//alert(arcNodes[i]["SCAttributes"][j]["id"]);
						//alert("Равны: "+ (arcNodes[i]["SCAttributes"][j]["id"] == addressMap[relation[g]]));
						if (arcNodes[i]["SCAttributes"][j]["id"] == addressMap[relation[g]]){
							//alert("Сортируем...");
							var temp = arcNodes[toPosition];
							arcNodes[toPosition] = arcNodes[i];
							arcNodes[i] = temp;
							toPosition++;
							//alert("Результат: " + JSON.stringify(arcNodes));
							//alert("Значение toPosition: " + toPosition);
							break;
						}
					}
				}
				//Когда аттрибутов у дуги нет.
				else{
					//Сравниваем ее с адресом искомого аттрибута.
					//alert("Дуга без аттрибута");
					//alert("Текущее значение relation:" + addressMap[relation[g]]);
					//alert(arcNodes[i]["id"]);
					//alert("Равны: "+ (arcNodes[i]["id"] == addressMap[relation[g]]));
					if (arcNodes[i]["id"] == addressMap[relation[g]]){
						//alert("Сортируем...");
						var temp = arcNodes[toPosition];
						arcNodes[toPosition] = arcNodes[i];
						arcNodes[i] = temp;
						toPosition++;
						//alert("Результат: " + JSON.stringify(arcNodes));
						//alert("Значение toPosition: " + toPosition);
					}
				}
			}
		}			
		//alert("Massive arcNodes: " + JSON.stringify(arcNodes));
		//alert(JSON.parse(data2front + JSON.stringify(arcNodes) + data2back));
		//alert("Returning value...");
		return JSON.parse(data2front + JSON.stringify(arcNodes) + data2back);
	};

    return {

        buildTree : function(addressMap, data, relation) {
			//alert("Now in buildTree!");
			//alert(JSON.stringify(arguments));
            var outputData = '';
			var sortedData = _sortDataByRelation(addressMap, data, relation);
			//alert("Get value - ok!");
			//alert(JSON.stringify(sortedData));
			for ( var keywordInd = 0; keywordInd < sortedData.length; keywordInd++) {
                outputData += _buildNode(sortedData[keywordInd]);
            };
            return outputData;
        }
    };
};

Ostis.ui.scn.HtmlAttributeBuilder = (function() {

    return {
        buildIdAttr : function(idVal) {

            return "id='" + idVal + "'";
        },

        buildClassAttr : function(cls) {

            return "class='" + cls + "'";
        },

        buildScnIdAttr : function(node) {

            return Ostis.ui.scn.HtmlAttributes.ID + "='" + node.id + "' ";
        },

        buildLabelAttr : function(node) {

            return Ostis.ui.scn.HtmlAttributes.LABEL + "='" + node.id + "' ";
        },

        buildLinkAttr : function(node) {

            return Ostis.ui.scn.HtmlAttributes.LINK + "='" + node.id + "'";
        }
    };
})();

Ostis.ui.scn.HtmlLinkBuilder = (function() {

    var _startFileWrapper = function(node) {

        var cssClass = Ostis.ui.scn.SCnCssClass.FILE + " "
                + Ostis.ui.scn.SCnCssClass.SELECTABLE;
        return "<span "
                + Ostis.ui.scn.HtmlAttributeBuilder.buildClassAttr(cssClass)
                + " " + Ostis.ui.scn.HtmlAttributeBuilder.buildScnIdAttr(node)
                + ">";
    };

    var _closeFileWrapper = function() {

        return "</span>";
    };

    var _beginLinkContainer = function(viewerId, node) {

        var containerId = Ostis.ui.scn.IdentifierGenerator.generateLinkId(
                viewerId, node.id);
        return "<div "
                + Ostis.ui.scn.HtmlAttributeBuilder.buildIdAttr(containerId)
                + " " + Ostis.ui.scn.HtmlAttributeBuilder.buildLinkAttr(node)
                + ">";
    };

    var _endLinkContainer = function() {

        return "</div>";
    };

    return {

        buildLink : function(container, link) {

            var result = _startFileWrapper(link);
            result += _beginLinkContainer(container, link);
            result += _endLinkContainer();
            result += _closeFileWrapper();
            return result;
        }
    };
})();

Ostis.ui.scn.SCnComponent = {
        ext_lang: 'scn_code',
    formats : ['format_scn_json'],
    factory : function(sandbox) {
        return new Ostis.ui.scn.Viewer(sandbox);
    }
};

SCWeb.core.ComponentManager.appendComponentInitialize(Ostis.ui.scn.SCnComponent);

Ostis.ui.scn.HtmlAttributes = {
    ID : 'sc_addr',
    LABEL : 'scnLableFor',
    LINK : 'scnLinkFor',
    HTML_ID : "id"
};

Ostis.ui.scn.SCnCssClass = {
    KEYWORD : 'SCnKeyword',
    SENTENCE : 'Sentence',
    FIELD : 'SCnField',
    LINK : 'SCnLink',
    MARKER : 'SCnFieldMarker',
    VALUE : 'SCnFieldValue',
    FILE : 'SCnNoTransContent',
    LOOP : 'SCnTransContent',
    SELECTABLE : 'SCnSelectable',
    HOVERED : 'SCnHovered',
    SELECTED : 'SCnSelected',
    LEVEL : 'SCnLevel'
};


Ostis.ui.scn.Selection = function(parent) {

    var elementQueue = [];
    var parentSelector = '#' + parent;

    var _elementClick = function(event) {

        if (event.ctrlKey) {
            var scAddr;
            $(event.currentTarget).toggleClass(
                    Ostis.ui.scn.SCnCssClass.SELECTED, true);
            scAddr = $(event.currentTarget)
                    .attr(Ostis.ui.scn.HtmlAttributes.ID);
            SCWeb.core.Arguments.appendArgument(scAddr);
        } else {
            scAddr = $(event.currentTarget)
                    .attr(Ostis.ui.scn.HtmlAttributes.ID);
            //$(parentSelector).trigger('semanticNeighbourhood', scAddr);
            SCWeb.core.Main.doDefaultCommand([scAddr]);
        }
    };

    var _elementEnter = function(event) {

        var elementToClearHover = _getLastElementInQueue();
        if (elementToClearHover) {
            $(elementToClearHover)
                    .removeClass(Ostis.ui.scn.SCnCssClass.HOVERED);
        }

        var elementToHover = event.currentTarget;
        elementQueue.push(elementToHover);
        $(elementToHover).addClass(Ostis.ui.scn.SCnCssClass.HOVERED);
    };

    var _elementLeave = function(event) {

        elementQueue.pop();
        $(event.currentTarget).removeClass(Ostis.ui.scn.SCnCssClass.HOVERED);

        var elementToHover = _getLastElementInQueue();
        if (elementToHover) {
            $(elementToHover).addClass(Ostis.ui.scn.SCnCssClass.HOVERED);
        }
    };

    var _getLastElementInQueue = function() {

        return elementQueue[elementQueue.length - 1];
    };

    var _selectElement = function(scAddr) {

        var expr = parentSelector + " [" + Ostis.ui.scn.HtmlAttributes.ID + "="
                + scAddr + "]";
        $(expr).each(function(index, element) {

            $(element).toggleClass(Ostis.ui.scn.SCnCssClass.SELECTED, true);
        });
    };

    return {
        init : function() {

            var selectableClassExpr = "." + Ostis.ui.scn.SCnCssClass.SELECTABLE;
            var hoveredClassExpr = "." + Ostis.ui.scn.SCnCssClass.HOVERED;
            $(parentSelector).delegate(selectableClassExpr, 'mouseenter',
                    $.proxy(_elementEnter, this));
            $(parentSelector).delegate(selectableClassExpr, 'mouseleave',
                    $.proxy(_elementLeave, this));
            $(parentSelector).delegate(hoveredClassExpr, 'click',
                    $.proxy(_elementClick, this));
        },

        preselectArguments : function() {

            var toSelect = SCWeb.core.Arguments.getArguments();
            for ( var toSelInd = 0; toSelInd < toSelect.length; toSelInd++) {
                _selectElement(toSelect[toSelInd]);
            }
        },

        argumentAppended : function(argument, idx) {

            _selectElement(argument);
        },

        argumentRemoved : function(argument, idx) {

            var expr = parentSelector + " ."
                    + Ostis.ui.scn.SCnCssClass.SELECTED + "["
                    + Ostis.ui.scn.HtmlAttributes.ID + "=" + argument + "]";
            $(expr).each(
                    function(index, element) {

                        $(element).toggleClass(
                                Ostis.ui.scn.SCnCssClass.SELECTED, false);
                    });
        },

        argumentsCleared : function() {

            var expr = parentSelector + " ."
                    + Ostis.ui.scn.SCnCssClass.SELECTED;
            $(expr).each(
                    function(index, element) {

                        $(element).toggleClass(
                                Ostis.ui.scn.SCnCssClass.SELECTED, false);
                    });
        }
    };
};

Ostis.ui.scn.TypeResolver = (function() {

    var scnArcs = [];
    scnArcs[sc_type_edge_common] = {
        forward : '↔',
        backward : '↔'
    };
    scnArcs[sc_type_arc_common] = {
        forward : '→',
        backward : '←'
    };
    scnArcs[sc_type_arc_access] = {
        forward : '..∍',
        backward : '∊..'
    };
    scnArcs[sc_type_arc_pos_const_perm] = {
        forward : '∍',
        backward : '∊'
    };
    scnArcs[sc_type_edge_common | sc_type_const] = {
        forward : '⇔',
        backward : '⇔'
    };
    scnArcs[sc_type_edge_common | sc_type_var] = {
        forward : '⇐⇒',
        backward : '⇐⇒'
    };
    scnArcs[sc_type_arc_common | sc_type_const] = {
        forward : '⇒',
        backward : '⇐'
    };
    scnArcs[sc_type_arc_common | sc_type_var] = {
        forward : '_⇒',
        backward : '_⇐'
    };
    scnArcs[sc_type_arc_access | sc_type_const] = {
        forward : '_∍',
        backward : '_∊'
    };
    // --
    scnArcs[sc_type_arc_access | sc_type_const | sc_type_arc_neg
            | sc_type_arc_perm] = {
        forward : '∌',
        backward : '∉'
    };
    scnArcs[sc_type_arc_access | sc_type_var | sc_type_arc_neg
            | sc_type_arc_perm] = {
        forward : '_∌',
        backward : '_∉'
    };
    scnArcs[sc_type_arc_access | sc_type_const | sc_type_arc_fuz
            | sc_type_arc_perm] = {
        forward : '/∍',
        backward : '∊/'
    };
    scnArcs[sc_type_arc_access | sc_type_var | sc_type_arc_fuz
            | sc_type_arc_perm] = {
        forward : '_/∍',
        backward : '_∊/'
    };
    // ---
    scnArcs[sc_type_arc_access | sc_type_const | sc_type_arc_pos
            | sc_type_arc_temp] = {
        forward : '~∍',
        backward : '∊~'
    };
    scnArcs[sc_type_arc_access | sc_type_var | sc_type_arc_pos
            | sc_type_arc_temp] = {
        forward : '_~∍',
        backward : '_∊~'
    };
    scnArcs[sc_type_arc_access | sc_type_const | sc_type_arc_neg
            | sc_type_arc_temp] = {
        forward : '~∌',
        backward : '∉~'
    };
    scnArcs[sc_type_arc_access | sc_type_var | sc_type_arc_neg
            | sc_type_arc_temp] = {
        forward : '_~∌',
        backward : '_∉~'
    };
    scnArcs[sc_type_arc_access | sc_type_const | sc_type_arc_fuz
            | sc_type_arc_temp] = {
        forward : '~/∍',
        backward : '∊/~'
    };
    scnArcs[sc_type_arc_access | sc_type_var | sc_type_arc_fuz
            | sc_type_arc_temp] = {
        forward : '_~/∍',
        backward : '_∊/~'
    };
    return {
        resolveArc : function(arcMask, backward) {

            return backward ? scnArcs[arcMask].backward
                    : scnArcs[arcMask].forward;
        },

        resolveNode : function(nodeMask) {

            return "";
        }
    };
})();

