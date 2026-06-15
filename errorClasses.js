class CustomError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CustomError';
    }
}

class WhatsAppError extends CustomError {
    constructor(message) {
        super(message);
        this.name = 'WhatsAppError';
    }
}

class OpenAIError extends CustomError {
    constructor(message) {
        super(message);
        this.name = 'OpenAIError';
    }
}

class ChatProcessingError extends CustomError {
    constructor(message) {
        super(message);
        this.name = 'ChatProcessingError';
    }
}

class AgendaError extends CustomError {
    constructor(message) {
        super(message);
        this.name = 'AgendaError';
    }
}

module.exports = {
    CustomError,
    OpenAIError,
    WhatsAppError,
    ChatProcessingError,
    AgendaError
};