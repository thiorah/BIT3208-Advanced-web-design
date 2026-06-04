// Register
function register(){

    fetch("/registerUser", {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },

        body: JSON.stringify({
            username: document.getElementById("username").value,
            email: document.getElementById("regEmail").value,
            password: document.getElementById("regPassword").value
        })
    })

    .then(res => res.text())
    .then(data => {
        alert(data);
        window.location.href = "/";
    });
}

// Login
function login(){

    fetch("/loginUser", {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },

        body: JSON.stringify({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        })
    })

    .then(res => res.text())
    .then(data => {

        if(data === "Login successful"){
            window.location.href = "/dashboard";
        } else {
            alert(data);
        }
    });
}

// Add Repair
function addRepair(){

    fetch("/addRepair", {

        method: "POST",

        headers: {
            "Content-Type":"application/json"
        },

        body: JSON.stringify({
            customer_name: document.getElementById("customer_name").value,
            phone_model: document.getElementById("phone_model").value,
            repair_type: document.getElementById("repair_type").value,
            repair_price: document.getElementById("repair_price").value
        })
    })

    .then(res => res.text())
    .then(data => {
        alert(data);
        loadRepairs();
    });
}

// Load repairs
function loadRepairs(){

    fetch("/repairs")
    .then(res => res.json())
    .then(data => {

        let table = document.getElementById("repairTable");

        if(table){

            table.innerHTML = "";

            data.forEach(repair => {

                table.innerHTML += `
                <tr>
                    <td>${repair.customer_name}</td>
                    <td>${repair.phone_model}</td>
                    <td>${repair.repair_type}</td>
                    <td>${repair.repair_price}</td>
                </tr>
                `;
            });
        }
    });
}

loadRepairs();