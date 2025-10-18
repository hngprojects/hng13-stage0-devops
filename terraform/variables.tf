variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "HNG13-stage0"
  type        = string
  default     = "HNG13-stage0"
}

variable "instance_type" {
  description = "EC2 hng13-stage0"
  type        = string
  default     = "t2.micro"
}

variable "ami_id" {
  description = "Ubuntu EC2 instance"
  type        = string
  default     = "ami-0360c520857e3138f"
}

variable "key_name" {
  description = "Existing AWS key pair name"
  type        = string
  default     = "hng13-2"
}

variable "allowed_ssh_cidr" {
  description = "List of CIDR blocks allowed to access via SSH"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
