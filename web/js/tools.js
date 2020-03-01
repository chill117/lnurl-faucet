var app = app || {};

$(function() {

	$('.tool form').on('submit', function(event) {
		event.preventDefault();
		var tag = $(event.target).find(':input[name=tag]').val() || null;
		if (tag) {
			generateNewLnurl(tag);
		}
	});

	$('.tool .qrcode').on('click', function(event) {
		var $qrcode = $(event.target);
		var encoded = $qrcode.attr('data-encoded');
		if (encoded) {
			app.utils.copyToClipboard(encoded, function onSuccess() {
				var $copied = $qrcode.siblings('.copied').first();
				if ($copied.length === 0) {
					$copied = $('<div/>').addClass('copied');
					$('<b/>').text('Copied!').appendTo($copied);
					$copied.insertBefore($qrcode);
				}
				$copied.addClass('visible');
				setTimeout(function() {
					$copied.removeClass('visible');
					setTimeout(function() {
						$copied.remove();
					}, 350);
				}, 1700);
			});
		}
	});

	try {
		var ws = app.ws = (function() {
			var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
			var url = protocol + '//' + location.host;
			return new WebSocket(url);
		})();
		ws.onerror = function(error) {
			console.log('WebSocket ERROR', error);
		};
		ws.onopen = function() {
			console.log('WebSocket connection established');
		};
		ws.onclose = function() {
			console.log('WebSocket connection closed');
			ws = app.ws = null;
		};
		ws.onmessage = function(message) {
			try {
				console.log('WebSocket data received:', message.data);
				var messageData = JSON.parse(message.data);
				var eventName = messageData.event || null;
				if (!eventName) return;
				var tag = messageData.tag || null;
				if (!tag) return;
				var $tool = $('.tool.' + tag);
				var $qrcode = $tool.find('.qrcode');
				$qrcode.removeClass('loading').removeClass('loaded');
				var message = eventName;
				var data = messageData.data || {};
				var successOrError;
				switch (eventName) {
					case 'request:failed':
						successOrError = 'error';
						break;
					case 'request:processed':
					case 'login':
						successOrError = 'success';
						break;
				}
				addTagEvent(tag, message, data, successOrError);
			} catch (error) {
				console.log(error);
			}
		};
	} catch (error) {
		console.log(error);
	}

	$.get('/lnurls')
		.done(function(lnurls) {
			$('.tool').each(function() {
				var $tool = $(this);
				var tag = $tool.attr('data-tag');
				if (tag) {
					var encoded = lnurls[tag] || null;
					if (encoded) {
						var $qrcode = $tool.find('.qrcode');
						var data = 'lightning:' + encoded;
						app.utils.renderQrCode($qrcode, data, function(error) {
							if (error) {
								showTagError(tag, error);
							} else {
								$qrcode.addClass('loaded');
								$qrcode.attr('data-encoded', encoded).attr('title', 'Click to copy');
							}
						});
					} else {
						generateNewLnurl(tag);
					}
				}
			});
		})
		.fail(app.utils.showGeneralError);

	var generateNewLnurl = function(tag) {
		var $tool = $('.tool.' + tag);
		var $qrcode = $tool.find('.qrcode');
		var $form = $tool.find('form');
		var data;
		if ($form.length > 0) {
			data = $form.serializeJSON();
		} else {
			data = { tag: tag };
		}
		var done = function(error) {
			$qrcode.removeClass('loading').addClass('loaded');
			if (error) showTagError(tag, error);
		};
		$qrcode.removeClass('loaded').addClass('loading');
		clearTagEvents(tag);
		$.post('/lnurl', data)
			.done(function(encoded) {
				var data = 'lightning:' + encoded;
				app.utils.renderQrCode($qrcode, data, function(error) {
					if (error) return done(error);
					$qrcode.attr('data-encoded', encoded).attr('title', 'Click to copy');
					done();
				});
			})
			.fail(function(error) {
				showTagError(tag, error);
			});
	};

	var clearTagEvents = function(tag) {
		var $tool = $('.tool.' + tag);
		var $events = $tool.find('.events');
		$events.empty();
	};

	var addTagEvent = function(tag, message, eventData, successOrError) {
		var $tool = $('.tool.' + tag);
		var $events = $tool.find('.events');
		var $newEvent = $('<div/>')
			.addClass('event')
			.addClass(successOrError)
			.text(message);
		if (eventData) {
			$newEvent.attr('data-event', JSON.stringify(eventData));
		}
		$newEvent.appendTo($events);
		_.defer(function() {
			$newEvent.addClass('visible');
		});
		$newEvent.on('click', function(event) {
			var $target = $(event.target);
			var eventData = $target.attr('data-event');
			_.defer(showEventDetails, eventData);
		});
	};

	var showEventDetails = function(eventData) {
		eventData = eventData || {};
		var message = JSON.stringify(JSON.parse(eventData), null, 4/* indent */);
		var $message = $('<textarea/>', {
			rows: (message.match(/\n/g) || []).length + 2,
		});
		$message.text(message);
		app.utils.showMessage($message);
	};

	var showTagError = function(tag, error) {
		var message = app.utils.normalizeErrorMessage(error);
		addTagEvent(tag, message, null, 'error');
	};

});
