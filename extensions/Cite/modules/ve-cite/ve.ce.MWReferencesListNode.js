/*!
 * VisualEditor ContentEditable MWReferencesListNode class.
 *
 * @copyright 2011-2018 VisualEditor Team's Cite sub-team and others; see AUTHORS.txt
 * @license MIT
 */

/**
 * ContentEditable MediaWiki references list node.
 *
 * @class
 * @extends ve.ce.LeafNode
 * @mixin ve.ce.FocusableNode
 *
 * @constructor
 * @param {ve.dm.MWReferencesListNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.MWReferencesListNode = function VeCeMWReferencesListNode() {
	// Parent constructor
	ve.ce.MWReferencesListNode.super.apply( this, arguments );

	// Mixin constructors
	ve.ce.FocusableNode.call( this );

	// Properties
	this.internalList = null;
	this.listNode = null;
	this.modified = false;

	// DOM changes
	this.$element.addClass( 've-ce-mwReferencesListNode' );
	this.$reflist = $( '<ol>' ).addClass( 'mw-references references' );
	this.$originalRefList = null;
	this.$refmsg = $( '<p>' )
		.addClass( 've-ce-mwReferencesListNode-muted' );

	// Events
	this.getModel().connect( this, { attributeChange: 'onAttributeChange' } );

	this.updateDebounced = ve.debounce( this.update.bind( this ) );

	// Initialization
	this.updateDebounced();
};

/* Inheritance */

OO.inheritClass( ve.ce.MWReferencesListNode, ve.ce.LeafNode );

OO.mixinClass( ve.ce.MWReferencesListNode, ve.ce.FocusableNode );

/* Static Properties */

ve.ce.MWReferencesListNode.static.name = 'mwReferencesList';

ve.ce.MWReferencesListNode.static.tagName = 'div';

ve.ce.MWReferencesListNode.static.primaryCommandName = 'referencesList';

/* Static Methods */

/**
 * @inheritdoc
 */
ve.ce.MWReferencesListNode.static.getDescription = function ( model ) {
	return model.getAttribute( 'refGroup' );
};

/* Methods */

/**
 * Handle setup events.
 *
 * @method
 */
ve.ce.MWReferencesListNode.prototype.onSetup = function () {
	this.internalList = this.getModel().getDocument().getInternalList();
	this.listNode = this.internalList.getListNode();

	this.internalList.connect( this, { update: 'onInternalListUpdate' } );
	this.listNode.connect( this, { update: 'onListNodeUpdate' } );

	// Parent method
	ve.ce.MWReferencesListNode.super.prototype.onSetup.call( this );
};

/**
 * Handle teardown events.
 *
 * @method
 */
ve.ce.MWReferencesListNode.prototype.onTeardown = function () {
	// Parent method
	ve.ce.MWReferencesListNode.super.prototype.onTeardown.call( this );

	if ( !this.listNode ) {
		return;
	}

	this.internalList.disconnect( this, { update: 'onInternalListUpdate' } );
	this.listNode.disconnect( this, { update: 'onListNodeUpdate' } );

	this.internalList = null;
	this.listNode = null;
};

/**
 * Handle the updating of the InternalList object.
 *
 * This will occur after a document transaction.
 *
 * @method
 * @param {string[]} groupsChanged A list of groups which have changed in this transaction
 */
ve.ce.MWReferencesListNode.prototype.onInternalListUpdate = function ( groupsChanged ) {
	// Only update if this group has been changed
	if ( groupsChanged.indexOf( this.getModel().getAttribute( 'listGroup' ) ) !== -1 ) {
		this.modified = true;
		this.updateDebounced();
	}
};

/**
 * Rerender when the 'listGroup' attribute changes in the model.
 *
 * @param {string} key Attribute key
 * @param {string} from Old value
 * @param {string} to New value
 */
ve.ce.MWReferencesListNode.prototype.onAttributeChange = function ( key ) {
	switch ( key ) {
		case 'listGroup':
			this.updateDebounced();
			this.modified = true;
			break;
		case 'isResponsive':
			this.updateClasses();
			break;
	}
};

/**
 * Handle the updating of the InternalListNode.
 *
 * This will occur after changes to any InternalItemNode.
 *
 * @method
 */
ve.ce.MWReferencesListNode.prototype.onListNodeUpdate = function () {
	// When the list node updates we're not sure which list group the item
	// belonged to so we always update
	// TODO: Only re-render the reference which has been edited
	this.updateDebounced();
};

/**
 * Update the references list.
 */
ve.ce.MWReferencesListNode.prototype.update = function () {
	var model = this.getModel();

	// Check the node hasn't been destroyed, as this method is debounced.
	if ( !model ) {
		return;
	}

	var internalList = model.getDocument().internalList;
	var refGroup = model.getAttribute( 'refGroup' );
	var listGroup = model.getAttribute( 'listGroup' );
	var nodes = internalList.getNodeGroup( listGroup );

	var emptyText;
	if ( refGroup !== '' ) {
		emptyText = ve.msg( 'cite-ve-referenceslist-isempty', refGroup );
	} else {
		emptyText = ve.msg( 'cite-ve-referenceslist-isempty-default' );
	}

	// Just use Parsoid-provided DOM for first rendering
	// NB: Technically this.modified could be reset to false if this
	// node is re-attached, but that is an unlikely edge case.
	if ( !this.modified && model.getElement().originalDomElementsHash ) {
		// Create a copy when importing to the main document, as extensions may
		// modify DOM nodes in the main doc.
		this.$originalRefList = $( ve.copyDomElements( model.getStore().value(
			model.getElement().originalDomElementsHash
		), document ) );
		// Check for references in the model. If none are found do a slower check
		// to see if $originalRefList has any, as they could all be defined in templates.
		if ( ( nodes && nodes.indexOrder.length ) || this.$originalRefList.find( 'li' ).length ) {
			this.$element.append( this.$originalRefList );
		} else {
			this.$refmsg.text( emptyText );
			this.$element.append( this.$refmsg );
		}
		return;
	}

	if ( this.$originalRefList ) {
		this.$originalRefList.remove();
		this.$originalRefList = null;
	}
	this.$reflist.detach().empty();
	this.$refmsg.detach();

	if ( refGroup !== '' ) {
		this.$reflist.attr( 'data-mw-group', refGroup );
	} else {
		this.$reflist.removeAttr( 'data-mw-group' );
	}

	if ( !nodes || !nodes.indexOrder.length ) {
		this.$refmsg.text( emptyText );
		this.$element.append( this.$refmsg );
	} else {
		for ( var i = 0, iLen = nodes.indexOrder.length; i < iLen; i++ ) {
			var index = nodes.indexOrder[ i ];
			var firstNode = nodes.firstNodes[ index ];

			var key = internalList.keys[ index ];
			var keyedNodes = nodes.keyedNodes[ key ];
			keyedNodes = keyedNodes.filter( function ( node ) {
				// Exclude placeholder references
				if ( node.getAttribute( 'placeholder' ) ) {
					return false;
				}
				// Exclude references defined inside the references list node
				do {
					node = node.parent;
					if ( node instanceof ve.dm.MWReferencesListNode ) {
						return false;
					}
				} while ( node );
				return true;
			} );

			if ( !keyedNodes.length ) {
				continue;
			}

			var $li = $( '<li>' )
				.append( this.renderBacklinks( keyedNodes, refGroup ) );

			// Generate reference HTML from first item in key
			var modelNode = internalList.getItemNode( firstNode.getAttribute( 'listIndex' ) );
			if ( modelNode && modelNode.length ) {
				var refPreview = new ve.ui.MWPreviewElement( modelNode, { useView: true } );
				$li.append(
					$( '<span>' )
						.addClass( 'reference-text' )
						.append( refPreview.$element )
				);
			} else {
				$li.append(
					$( '<span>' )
						.addClass( 've-ce-mwReferencesListNode-muted' )
						.text( ve.msg( 'cite-ve-referenceslist-missingref-in-list' ) )
				);
			}

			this.$reflist.append( $li );
		}
		this.updateClasses();
		this.$element.append( this.$reflist );
	}
};

/**
 * Update ref list classes.
 *
 * Currently used to set responsive layout
 */
ve.ce.MWReferencesListNode.prototype.updateClasses = function () {
	var isResponsive = this.getModel().getAttribute( 'isResponsive' );

	this.$element
		.toggleClass( 'mw-references-wrap', isResponsive )
		.toggleClass( 'mw-references-columns', isResponsive && this.$reflist.children().length > 10 );
};

/**
 * Build markers for backlinks
 *
 * @param {ve.dm.Node[]} keyedNodes A list of ref nodes linked to a reference list item
 * @param {string} refGroup Reference group name
 * @return {jQuery} Element containing backlinks
 */
ve.ce.MWReferencesListNode.prototype.renderBacklinks = function ( keyedNodes, refGroup ) {
	var $link;
	if ( keyedNodes.length > 1 ) {
		// named reference with multiple usages
		var $refSpan = $( '<span>' ).attr( 'rel', 'mw:referencedBy' );
		for ( var j = 0, jLen = keyedNodes.length; j < jLen; j++ ) {
			$link = $( '<a>' ).append(
				$( '<span>' ).addClass( 'mw-linkback-text' )
					.text( ( j + 1 ) + ' ' )
			);
			if ( refGroup !== '' ) {
				$link.attr( 'data-mw-group', refGroup );
			}
			$refSpan.append( $link );
		}
		return $refSpan;
	} else {
		// solo reference
		$link = $( '<a>' ).attr( 'rel', 'mw:referencedBy' ).append(
			$( '<span>' ).addClass( 'mw-linkback-text' )
				.text( '↑ ' )
		);
		if ( refGroup !== '' ) {
			$link.attr( 'data-mw-group', refGroup );
		}
		return $link;
	}
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.MWReferencesListNode );
