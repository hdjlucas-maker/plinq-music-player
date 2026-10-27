// Copilot vai sugerir isso automaticamente!
async function getFreelancerRate(service) {
    // Copilot sugere a chamada da API
    const response = await fetch(`https://api.freelancer.com/rates/${service}`);
    const data = await response.json();
    return data.rate;
}

// Copilot sugere como usar!
getFreelancerRate("web-design")
    .then(rate => console.log(`Taxa para ${service}: R$${rate}`))
    .catch(error => console.error("Erro:", error));