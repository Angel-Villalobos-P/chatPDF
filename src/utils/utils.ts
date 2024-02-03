const getEnv = (key: string): string => {
    const value = process.env[ key ]
    if (!value) {
        throw new Error(`Missing env var ${key}`)
    }
    return value
}

const validateEnvironmentVariables = () => {
    getEnv('PINECONE_API_KEY')
    getEnv('PINECONE_ENVIRONMENT')
}

const convertToAscii = (inputString: string) => {
    // remove non ascii characters
    const asciiString = inputString.replace(/[^\x00-\x7F]/g, "")
    return asciiString
}

export { getEnv, validateEnvironmentVariables, convertToAscii }