terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.2.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "4.1.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.7.2"
    }
  }
}

provider "aws" {
  region = "us-east-1"

}

resource "aws_security_group" "nginx_sg" {
  name        = "nginx-access-sg"
  description = "Allow HTTP and SSH inbound traffic"

  # Allow SSH from anywhere(Port 22)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow HTTP from anywhere (Port 80)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "nginx_server" {
  ami           = "ami-0ecb62995f68bb549" # Canonical Ubuntu 24.04 LTS AMI (us-east-1)
  instance_type = "t2.micro"

  key_name               = aws_key_pair.my_ssh_key.key_name
  vpc_security_group_ids = [aws_security_group.nginx_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              sudo apt update -y
              sudo apt install -y nginx
              sudo systemctl start nginx
              sudo systemctl enable nginx
              sudo cp ../index.html /var/www/
EOF

  tags = {
    Name = "Nginx-Terraform-Server"
  }
}


# Generates the private key content locally
resource "tls_private_key" "my_rsa_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Uploads the public key portion to Aws EC2
resource "aws_key_pair" "my_ssh_key" {
  key_name   = "terraform-key-${random_pet.suffix.id}"
  public_key = tls_private_key.my_rsa_key.public_key_openssh
}

# Saves the private key content to a local .pem file
resource "local_file" "ssh_key_pem" {
  filename        = "${aws_key_pair.my_ssh_key.key_name}.pem"
  content         = tls_private_key.my_rsa_key.private_key_pem
  file_permission = "0400" # Sets secure file permission
}

# Utility to create a unique key name (requires random provider)
resource "random_pet" "suffix" {
  length = 2

}


# Show the EC2 public IP address after deployment
output "nginx_server_public_ip" {
  description = "Public IP address of the Nginx EC2 instance"
  value       = aws_instance.nginx_server.public_ip
}

# Show a clickable URL for easy access to your web server
output "nginx_server_url" {
  description = "URL to access the Nginx server"
  value       = "http://${aws_instance.nginx_server.public_ip}"
}
