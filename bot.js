// Let's invite people to the party !
var irc = require('irc'), fs = require('fs');

// vars
var	linesBuffer=[],
	bufferTimeout,
	watchs=[],
// consts
 	IRC_SRV='irc.freenode.net',
 	IRC_PORT=8002,
 	BOT_NAME='FranceJSBot',
 	BOT_REAL_NAME='Robot FranceJS',
 	MAIN_CHANNEL='#francejs',
 	ADMINS=['nfroidure','naholyr','_kud'],
 	BUFFER_TIMEOUT=6, // seconds
 	BUFFER_SIZE=10, // lines
	LOG_DIR='logs', // rel to script path
	LOG_NAME='irc', // rel to script path
	IRC_EVENT_MSG=1,
	IRC_EVENT_JOIN=2,
	IRC_EVENT_PART=4,
	IRC_EVENT_TOPIC=8,
	IRC_EVENT_BOT=16,
	IRC_EVENT_QUIT=32,
	IRC_EVENT_KICK=64,
	IRC_EVENT_KILL=128,
	IRC_EVENT_NICK=256,
	IRC_DEST_SELECT=0,
	IRC_DEST_CHAN=1,
	IRC_DEST_NICK=2,
	IRC_DEST_SILENT=4;

// Write messages to the log when timeout is fired
function writeMessages()
	{
	var curDate=new Date();
	fs.appendFile(__dirname+'/'+LOG_DIR+'/'+LOG_NAME+'-'+curDate.getDate()+'-'+curDate.getFullYear()+'.log',
		linesBuffer.join('\n')+'\n', function(err)
		{
		console.log(err||"Message buffer saved!");
		});
	linesBuffer.length=0;
	}

// Add message to buffer
function logMessage(type,fields)
	{
	var message;
	if(linesBuffer.length<BUFFER_SIZE&&bufferTimeout)
		clearTimeout(bufferTimeout);
	if(fields.length!==2)
		throw RangeError('Not enougth fields sent');
	// Saving message
	message=fields[1];
	// Escaping double quotes
	fields.forEach(function(item,i)
		{
		fields[i]='"'+item.replace(/"/g,'\\"')+'"';
		});
	// Adding log type and date
	fields.unshift(type,Date.now()); // unshift to keep CSV format extendable
	// Pushing to the buffer
	linesBuffer.push(fields.join(','));
	bufferTimeout=setTimeout(writeMessages,BUFFER_TIMEOUT*1000);
	return message;
	}

// Commands
function executeCommand(command,nick,origin)
	{
	var messages, destination;
	switch(command.split(' ')[0].toLowerCase())
		{
		case 'ls':
		case 'help':
		case 'commands':
			dest=IRC_DEST_NICK;
			messages=['I understand the following commands :',
				'- ls/commands : list commands',
				'- hello/lo : kinda cool to say hello!',
				'- watch <nickname> : tells you when <nickname> talk',
				'- unwatch <nickname> : stops telling you when <nickname> talk',
				'- dice <faces> <num> : Lets hazard comes',
				'- seen <nickname> : last connection of <nickname> (not implemented)',
				'- diffuse <message> : diffuse a message to each js chan (#parisjs, #francejs) (not implemented)',
				'- log <n> <start> <date> : give the <n> messages nick <start> on <date> (not implemented)',
				'- todo : adds items todo (not implemented)'];
			break;
		case 'lo':
		case 'hello':
		case 'hi':
			dest=IRC_DEST_SELECT;
			messages=['Hi! Nice to see you!'];
			break;
		case 'd':
		case 'roll':
		case 'dice':
			dest=IRC_DEST_SELECT;
			var args=command.split(' ');
			if(args.length<2)
				{
				messages=[IRC_DEST_CHAN,'Not enought args given for the d command.'];
				break;
				}
			args[1]=parseInt(args[1]);
			args[2]=parseInt(args[2]);
			if(isNaN(args[1])||args[1]<2)
				{
				messages=['Invalid face count for d command (numFaces >= 2).'];
				break;
				}
			if(args[2]&&(isNaN(args[2])||args[2]<1||args[2]>11))
				{
				messages=['Invalid dice count for d command (11 < numDices >= 2).'];
				break;
				}
			var result = '';
			for(var i=0, j=(args[2]?args[2]:1); i<j; i++)
				result+=(result?' ':'')+Math.round((Math.random()*(args[1]-1))+1);
			messages=[result];
			break;
		case 'say':
			if(-1===ADMINS.indexOf(nick))
				{
				dest=IRC_DEST_NICK;
				messages=['Not allowed to say that.'];
				break;
				}
			dest=IRC_DEST_CHAN|IRC_DEST_SILENT;
			messages=[command.split(' ').splice(1).join(' ')];
			break;
		case 'bitch':
		case 'bastard':
		case 'motherfucker':
		case 'fuck':
		case 'fucker':
		case 'idiot':
		case 'git':
			dest=IRC_DEST_SELECT;
			messages=[IRC_DEST_SELECT,'Nice to meet you "'+command.split(' ')[0]+'", I\'m '+BOT_NAME+', waiting for commands!'];
			break;
		case 'watch':
			dest=IRC_DEST_NICK;
			var args=command.split(' ');
			if(args.length<2)
				{
				messages=['Not enought args given for the watch command.'];
				break;
				}
			if(args[1]==BOT_NAME)
				{
				messages=['Bots have private life too.'];
				break;
				}
			if(watchs[args[1]]&&-1!==watchs[args[1]].indexOf(nick))
				{
				messages=['You\'re already watching '+args[1]+'.'];
				break;
				}
			(undefined!==watchs[args[1]]&&watchs[args[1]].push(nick)||(watchs[args[1]]=[nick+'']));
			messages=['Now you\'re watching '+args[1]+'.'];
			break;
		case 'unwatch':
			dest=IRC_DEST_NICK;
			var args=command.split(' ');
			if(args.length<2)
				{
				messages=['Not enought args given for the unwatch command'];
				break;
				}
			var index=watchs[args[1]].indexOf(nick);
			if(watchs[args[1]]&&-1!==index&&watchs[args[1]].splice(index,1));
				{
				messages=['You unwatched '+args[1]+'.'];
				break;
				}
			messages=['You wasn\'t watching '+args[1]+'.'];
			break;
		case 'seen':
		case 'diffuse':
		case 'log':
		case 'todo':
			dest=IRC_DEST_SELECT;
			messages=['Not implemented, but feel free to : https://github.com/francejs/irc-bot'];
			break;
		default:
			dest=IRC_DEST_SELECT;
			messages=["You\'re talking to me ?? Try ls."];
			break;
		}
	if(dest===IRC_DEST_SELECT)
		dest|=origin;
	(dest&IRC_DEST_CHAN)&&messages.forEach(function(msg,i)
		{
		client.say(MAIN_CHANNEL,logMessage(IRC_EVENT_MSG|IRC_EVENT_BOT,[BOT_NAME,(i===0&&!(dest&IRC_DEST_SILENT)?nick +': ':'')+ msg]));
		});
	(dest&IRC_DEST_NICK)&&messages.forEach(function(msg)
		{
		client.say(nick, msg);
		});
	}
	
// Starting IRC client
var client = new irc.Client(IRC_SRV, BOT_NAME,
	{
	realName: BOT_REAL_NAME,
	port: IRC_PORT,
	autoRejoin: false,
    autoConnect: false
	});

// Connecting to IRC
client.connect(Infinity, function()
	{
	client.join(MAIN_CHANNEL);
	});

// Listening for messages
var botRegExp=new RegExp(BOT_NAME+'([ ,:]+)');
client.addListener('message'+MAIN_CHANNEL, function (nick, message)
	{
	// Logging message
	logMessage(IRC_EVENT_MSG,[nick, message]);
	// Looking for a command to execute
	if(-1!==message.indexOf(BOT_NAME))
		{
		executeCommand(message.replace(botRegExp,''),nick,IRC_DEST_CHAN);
		}
	// Telling watchers
	(watchs[nick]||[]).forEach(function(watcher,i)
			{
			client.say(watcher,nick +' said : '+ message);
			});
	});

client.addListener('pm', function (nick, message)
	{
	executeCommand(message,nick,IRC_DEST_NICK);
	});

// Listening for incoming people
client.addListener('join'+MAIN_CHANNEL, function (nick, message)
	{
	if(-1!==nick.indexOf(BOT_NAME))
		{
		logMessage(IRC_EVENT_JOIN|IRC_EVENT_BOT,[nick, nick+' join the chan.']);
		//client.say(MAIN_CHANNEL, logMessage(IRC_EVENT_MSG|IRC_EVENT_BOT,[BOT_NAME,'Pouah! This chan is filled with humans.']));
		}
	else
		{
		logMessage(IRC_EVENT_JOIN,[nick, nick+' join the chan.']);
		// Enable this when someone connects for the first time only
		//client.say(MAIN_CHANNEL, logMessage(IRC_EVENT_MSG|IRC_EVENT_BOT,[BOT_NAME,'Welcome '+nick+'. I obey to commands, not to humans.']));
		}
	});

// Listening for topic changes
client.addListener('topic', function (chan, topic, nick, message)
	{
	nick&&logMessage(IRC_EVENT_TOPIC,[nick, nick+' change topic to "'+topic+'"']);
	});

// Listening for leaving people
client.addListener('part'+MAIN_CHANNEL, function (nick, message)
	{
	logMessage(IRC_EVENT_PART,[nick, nick+' leave the chan.']);
	});
client.addListener('quit', function (nick, reason, channels, message)
	{
	if(-1!==channels.indexOf(MAIN_CHANNEL))
		logMessage(IRC_EVENT_QUIT,[nick, nick+' leave the IRC ('+reason+').']);
	});

// Listening for killed people
client.addListener('kill', function (nick, reason, channels, message)
	{
	if(-1!==channels.indexOf(MAIN_CHANNEL))
		logMessage(IRC_EVENT_KILL,[nick, nick+' has been killed from IRC ('+reason+').']);
	});

// Listening for kicked people
client.addListener('kick'+MAIN_CHANNEL, function (nick, by, reason, message)
	{
	logMessage(IRC_EVENT_KICK,[nick, nick+' has been kicked by '+by+' ('+reason+').']);
	});

// Listening for nick changes
client.addListener('nick', function (oldNick, newNick, channels, message)
	{
	if(-1!==channels.indexOf(MAIN_CHANNEL))
		logMessage(IRC_EVENT_NICK,[oldNick, oldNick+' changed his nick for '+newNick+'.']);
	});

// Shoud listen for disconnections to discard watchs
// or not, people will assume that watchs are disconnect safe

client.addListener('error', function(message)
	{
	console.log('error: ', message);
	});
